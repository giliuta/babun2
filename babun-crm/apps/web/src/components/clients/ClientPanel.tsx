"use client";

import { useMemo, useState } from "react";
import type { Client, ACUnit, ACType } from "@/lib/clients";
import { AC_TYPE_LABELS, PROPERTY_LABELS } from "@/lib/clients";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount, getDebtAmount, STATUS_LABELS } from "@/lib/appointments";
import { useServices, useTeams } from "@/app/dashboard/layout";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";

interface ClientPanelProps {
  client: Client;
  appointments: Appointment[];
  onUpdate: (updated: Client) => void;
  onClose: () => void;
}

type TabKey = "profile" | "records" | "history" | "reminders" | "equipment";

// Bumpix-style client card.
// Tabs layout: Профиль / Записи / История / Центр напоминаний /
// Оборудование. Profile is a clean vertical form; Записи is the full
// list of client's visits with sub-filter chips; История is the visit
// log (free-form technician notes); Центр напоминаний is the SMS queue
// built from appointments with reminders enabled; Оборудование is
// Babun-specific — A/C units registered for this client.

export default function ClientPanel({
  client,
  appointments,
  onUpdate,
}: ClientPanelProps) {
  const [tab, setTab] = useState<TabKey>("profile");
  const { teams } = useTeams();
  const { services } = useServices();

  const clientApts = useMemo(
    () => appointments.filter((a) => a.client_id === client.id),
    [appointments, client.id]
  );
  const completedApts = useMemo(
    () =>
      clientApts
        .filter((a) => a.status === "completed")
        .sort((a, b) =>
          (b.date + b.time_start).localeCompare(a.date + a.time_start)
        ),
    [clientApts]
  );
  const recordsCount = clientApts.length;
  const remindersCount = useMemo(
    () =>
      clientApts
        .filter((a) => a.reminder_enabled && a.status === "scheduled")
        .reduce((sum, a) => sum + a.reminder_offsets.length, 0),
    [clientApts]
  );

  const update = <K extends keyof Client>(key: K, value: Client[K]) => {
    onUpdate({ ...client, [key]: value });
  };

  const servicesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.name);
    return map;
  }, [services]);

  const teamsById = useMemo(() => {
    const map = new Map<string, { name: string; color?: string }>();
    for (const t of teams) map.set(t.id, { name: t.name, color: t.color });
    return map;
  }, [teams]);

  return (
    <div className="flex flex-col bg-white">
      {/* Tabs bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-white sticky top-0 z-10">
        <TabBtn label="Профиль" active={tab === "profile"} onClick={() => setTab("profile")} />
        <TabBtn
          label={`Записи (${recordsCount})`}
          active={tab === "records"}
          onClick={() => setTab("records")}
        />
        <TabBtn
          label={`История (${completedApts.length})`}
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
        <TabBtn
          label={`Центр напоминаний (${remindersCount})`}
          active={tab === "reminders"}
          onClick={() => setTab("reminders")}
        />
        <TabBtn
          label={`Оборудование (${client.equipment.length})`}
          active={tab === "equipment"}
          onClick={() => setTab("equipment")}
        />
      </div>

      {/* Content */}
      <div className="flex-1">
        {tab === "profile" && (
          <ProfileForm client={client} onUpdate={onUpdate} update={update} />
        )}
        {tab === "records" && (
          <RecordsTab
            items={clientApts}
            servicesById={servicesById}
            teamsById={teamsById}
          />
        )}
        {tab === "history" && (
          <HistoryTab items={completedApts} teamsById={teamsById} />
        )}
        {tab === "reminders" && (
          <RemindersTab
            client={client}
            items={clientApts}
            teamsById={teamsById}
          />
        )}
        {tab === "equipment" && (
          <EquipmentList client={client} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
        active
          ? "text-violet-700 border-violet-600"
          : "text-gray-500 border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Profile form ────────────────────────────────────────────────────────

function ProfileForm({
  client,
  onUpdate,
  update,
}: {
  client: Client;
  onUpdate: (c: Client) => void;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
}) {
  return (
    <div className="divide-y divide-gray-100">
      <FieldRow icon={<IconUser />} label="Имя и фамилия">
        <input
          type="text"
          value={client.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow
        icon={<IconPhone />}
        label="Телефон"
        right={
          client.phone ? (
            <div className="flex items-center gap-0.5">
              <a
                href={`tel:${client.phone.replace(/\D/g, "")}`}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-violet-700 active:bg-violet-50"
                aria-label="Позвонить"
              >
                <IconPhone />
              </a>
              <a
                href={`sms:${client.phone.replace(/\D/g, "")}`}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-violet-700 active:bg-violet-50"
                aria-label="Отправить SMS"
              >
                <IconChat />
              </a>
            </div>
          ) : null
        }
      >
        <input
          type="tel"
          value={client.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+357..."
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow icon={<IconChat />} label="Обращение в SMS напоминаниях">
        <input
          type="text"
          value={client.sms_name}
          onChange={(e) => update("sms_name", e.target.value)}
          placeholder={client.full_name.split(" ")[0] || "Имя"}
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow icon={<IconComment />} label="Комментарий">
        <textarea
          value={client.comment}
          onChange={(e) => update("comment", e.target.value)}
          rows={2}
          placeholder="Добавить комментарий"
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none resize-none"
        />
      </FieldRow>

      <FieldRow
        icon={<IconMoney />}
        label="Баланс"
        right={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => update("balance", client.balance + 10)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 text-[16px] active:bg-gray-300"
              aria-label="Увеличить"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => update("balance", client.balance - 10)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 text-[16px] active:bg-gray-300"
              aria-label="Уменьшить"
            >
              −
            </button>
          </div>
        }
      >
        <div className="text-[15px] text-gray-900">{client.balance} EUR</div>
      </FieldRow>

      <FieldRow icon={<IconClipboard />} label="Группы">
        <GroupsPicker
          active={client.tag_ids}
          onChange={(next) => update("tag_ids", next)}
        />
      </FieldRow>

      <FieldRow icon={<IconPercent />} label="Скидка">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={client.discount || ""}
            onChange={(e) => update("discount", Number(e.target.value) || 0)}
            className="w-16 bg-gray-50 border border-gray-200 rounded-md px-2 h-8 text-[15px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
            min={0}
            max={100}
          />
          <span className="text-[13px] text-gray-400">%</span>
        </div>
      </FieldRow>

      <FieldRow icon={<IconCake />} label="Дата рождения">
        <input
          type="date"
          value={client.birthday}
          onChange={(e) => update("birthday", e.target.value)}
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow icon={<IconMail />} label="E-mail">
        <input
          type="email"
          value={client.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="Введите E-mail"
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow icon={<IconPin />} label="Адрес">
        <input
          type="text"
          value={client.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Введите адрес"
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        />
      </FieldRow>

      <FieldRow icon={<IconCity />} label="Город">
        <select
          value={client.city}
          onChange={(e) => update("city", e.target.value)}
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        >
          <option value="">Выберите город</option>
          {["Лимассол", "Пафос", "Ларнака", "Никосия"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow icon={<IconHouse />} label="Тип объекта">
        <select
          value={client.property_type}
          onChange={(e) =>
            update("property_type", e.target.value as Client["property_type"])
          }
          className="w-full bg-transparent text-[15px] text-gray-900 focus:outline-none"
        >
          <option value="">Не указан</option>
          {(Object.entries(PROPERTY_LABELS) as [Client["property_type"], string][]).map(
            ([k, v]) => (k ? <option key={k} value={k}>{v}</option> : null)
          )}
        </select>
      </FieldRow>

      <FieldRow
        icon={<IconBlock />}
        label="Черный список"
        right={
          <Toggle
            on={client.blacklisted}
            onChange={(on) => update("blacklisted", on)}
          />
        }
      >
        <div className="text-[13px] text-gray-500">
          {client.blacklisted ? "Клиент в чёрном списке" : "Клиент не заблокирован"}
        </div>
      </FieldRow>
    </div>
  );
}

// ─── Records tab ────────────────────────────────────────────────────────

type RecordsFilter = "all" | "new" | "completed" | "cancelled" | "online";

const RECORD_FILTERS: { key: RecordsFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "completed", label: "Завершены" },
  { key: "cancelled", label: "Отменены" },
  { key: "online", label: "Онлайн" },
];

function RecordsTab({
  items,
  servicesById,
  teamsById,
}: {
  items: Appointment[];
  servicesById: Map<string, string>;
  teamsById: Map<string, { name: string; color?: string }>;
}) {
  const [filter, setFilter] = useState<RecordsFilter>("all");

  const counts = useMemo(() => {
    return {
      all: items.length,
      new: items.filter((a) => a.status === "scheduled").length,
      completed: items.filter((a) => a.status === "completed").length,
      cancelled: items.filter((a) => a.status === "cancelled").length,
      online: items.filter((a) => a.is_online_booking).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const base = items
      .slice()
      .sort((a, b) =>
        (b.date + b.time_start).localeCompare(a.date + a.time_start)
      );
    switch (filter) {
      case "new":
        return base.filter((a) => a.status === "scheduled");
      case "completed":
        return base.filter((a) => a.status === "completed");
      case "cancelled":
        return base.filter((a) => a.status === "cancelled");
      case "online":
        return base.filter((a) => a.is_online_booking);
      default:
        return base;
    }
  }, [items, filter]);

  return (
    <div>
      {/* Sub-filter chips */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-violet-700">
        {RECORD_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                active ? "text-white" : "text-violet-200"
              }`}
            >
              {f.label} ({counts[f.key]})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-gray-500">
          Записей нет
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((apt) => (
            <RecordCard
              key={apt.id}
              apt={apt}
              servicesById={servicesById}
              teamsById={teamsById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordCard({
  apt,
  servicesById,
  teamsById,
}: {
  apt: Appointment;
  servicesById: Map<string, string>;
  teamsById: Map<string, { name: string; color?: string }>;
}) {
  const paid = getPaidAmount(apt);
  const debt = getDebtAmount(apt);
  const total = apt.total_amount;
  const team = apt.team_id ? teamsById.get(apt.team_id) : null;

  // Service summary: "xN <first service> + rest"
  const quantities = new Map<string, number>();
  for (const id of apt.service_ids) {
    quantities.set(id, (quantities.get(id) ?? 0) + 1);
  }
  const servicePieces = Array.from(quantities.entries()).map(([id, qty]) => {
    const name = servicesById.get(id) ?? "Услуга";
    return qty > 1 ? `x${qty} ${name}` : name;
  });
  const serviceSummary = servicePieces.join(", ");

  const bg =
    apt.status === "completed"
      ? "bg-emerald-50"
      : apt.status === "cancelled"
      ? "bg-gray-50"
      : apt.status === "in_progress"
      ? "bg-violet-50"
      : "bg-sky-50";

  return (
    <div className={`${bg} px-4 py-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] text-gray-700">
          {formatRu(apt.date)} {apt.time_start}, {weekdayRu(apt.date)}
        </div>
        <div className="text-[12px] font-semibold text-gray-500 shrink-0">
          {STATUS_LABELS[apt.status]}
        </div>
      </div>
      {team && (
        <div className="text-[12px] text-gray-500 mt-0.5 flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: team.color || "#8b5cf6" }}
          />
          Мастер: {team.name}
        </div>
      )}
      {(serviceSummary || apt.comment) && (
        <div className="text-[13px] text-gray-900 mt-1 whitespace-pre-wrap break-words">
          {serviceSummary}
          {serviceSummary && apt.comment ? "\n" : ""}
          {apt.comment}
        </div>
      )}
      {/* Payment row */}
      <div className="flex items-center gap-3 mt-2 text-[12px]">
        <span className="flex items-center gap-1 text-emerald-700">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
            +
          </span>
          {paid}
        </span>
        <span className="flex items-center gap-1 text-rose-600">
          <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">
            −
          </span>
          {debt}
        </span>
        <span className="flex items-center gap-1 text-sky-700">
          <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">
            ·
          </span>
          {total}
        </span>
      </div>
    </div>
  );
}

// ─── History tab ────────────────────────────────────────────────────────
// Bumpix-style "log of visits" — each completed visit shows its free-form
// comment body (technician's notes from the field). Lightweight, readable.

function HistoryTab({
  items,
  teamsById,
}: {
  items: Appointment[];
  teamsById: Map<string, { name: string; color?: string }>;
}) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-[13px] text-gray-500">
        История пока пуста
      </div>
    );
  }
  return (
    <div className="divide-y divide-gray-100">
      {items.map((apt) => {
        const team = apt.team_id ? teamsById.get(apt.team_id) : null;
        return (
          <div key={apt.id} className="px-4 py-3">
            <div className="text-[13px] text-violet-700 font-semibold mb-1 border-b border-violet-100 pb-1">
              {formatRu(apt.date)} {apt.time_start}, {weekdayRu(apt.date)}
            </div>
            {team && (
              <div className="text-[11px] text-gray-500 mb-1">
                Мастер: {team.name}
              </div>
            )}
            {apt.comment ? (
              <div className="text-[14px] text-gray-900 whitespace-pre-wrap break-words">
                {linkify(apt.comment)}
              </div>
            ) : (
              <div className="text-[13px] text-gray-400 italic">
                Заметок нет
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function linkify(text: string) {
  const re = /(https?:\/\/[^\s]+)/g;
  const out: (string | React.JSX.Element)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a
        key={key++}
        href={m[0]}
        target="_blank"
        rel="noreferrer"
        className="text-violet-600 underline break-all"
      >
        {m[0]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ─── Reminders tab ──────────────────────────────────────────────────────

interface ReminderEntry {
  key: string;
  fireAt: Date;
  apt: Appointment;
  body: string;
}

function RemindersTab({
  client,
  items,
  teamsById,
}: {
  client: Client;
  items: Appointment[];
  teamsById: Map<string, { name: string; color?: string }>;
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());

  const reminders = useMemo<ReminderEntry[]>(() => {
    const now = Date.now();
    const out: ReminderEntry[] = [];
    for (const apt of items) {
      if (!apt.reminder_enabled) continue;
      if (apt.status !== "scheduled") continue;
      const [y, mo, d] = apt.date.split("-").map(Number);
      const [h, mn] = apt.time_start.split(":").map(Number);
      const start = new Date(y, mo - 1, d, h, mn).getTime();
      for (const offset of apt.reminder_offsets) {
        const fire = new Date(start - offset * 60_000);
        if (fire.getTime() < now - 24 * 3_600_000) continue;
        const body = renderReminder(apt.reminder_template, {
          name: client.sms_name || client.full_name.split(" ")[0] || "",
          date: formatRu(apt.date),
          time: apt.time_start,
          address: apt.address,
        });
        out.push({ key: `${apt.id}-${offset}`, fireAt: fire, apt, body });
      }
    }
    return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  }, [items, client]);

  if (reminders.length === 0) {
    return (
      <div className="p-8 text-center text-[13px] text-gray-500">
        Напоминаний нет. Включите напоминание в карточке записи — появится
        здесь.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {reminders.map((r) => {
        const team = r.apt.team_id ? teamsById.get(r.apt.team_id) : null;
        const wasSent = sent.has(r.key);
        const smsHref = client.phone
          ? `sms:${client.phone.replace(/\D/g, "")}?body=${encodeURIComponent(r.body)}`
          : undefined;
        return (
          <div
            key={r.key}
            className="bg-sky-50 rounded-2xl border border-sky-100 p-3"
          >
            <div className="flex items-start justify-between">
              <div className="text-[13px] text-gray-700 font-medium">
                {formatRuLong(r.fireAt)}
              </div>
              <div
                className={`text-[12px] font-semibold ${
                  wasSent ? "text-emerald-600" : "text-sky-600"
                }`}
              >
                {wasSent ? "Отправлено" : "Не выполнено"}
              </div>
            </div>
            {team && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                Мастер: {team.name}
              </div>
            )}
            <div className="text-[13px] font-semibold text-gray-900 mt-1.5">
              Напомнить о записи (SMS)
            </div>
            <div className="text-[13px] text-gray-800 whitespace-pre-wrap break-words mt-1">
              {r.body}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[12px] text-gray-700">
                SMS (вручную)
              </span>
              <a
                href={smsHref}
                onClick={(e) => {
                  if (!smsHref) {
                    e.preventDefault();
                    return;
                  }
                  setSent((prev) => {
                    const next = new Set(prev);
                    next.add(r.key);
                    return next;
                  });
                }}
                className={`h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center ${
                  smsHref
                    ? "bg-orange-500 text-white active:bg-orange-600"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                Отправить
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderReminder(
  template: string,
  vars: { name: string; date: string; time: string; address: string }
) {
  return template
    .replaceAll("{name}", vars.name)
    .replaceAll("{date}", vars.date)
    .replaceAll("{time}", vars.time)
    .replaceAll("{address}", vars.address);
}

// ─── Equipment tab ───────────────────────────────────────────────────────

function EquipmentList({
  client,
  onUpdate,
}: {
  client: Client;
  onUpdate: (c: Client) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [room, setRoom] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState<ACType>("split");

  const add = () => {
    if (!room.trim()) return;
    haptic("tap");
    const unit: ACUnit = {
      id: generateId("unit"),
      room: room.trim(),
      brand: brand.trim() || undefined,
      ac_type: type,
      has_indoor: true,
      has_outdoor: true,
    };
    onUpdate({ ...client, equipment: [...client.equipment, unit] });
    setRoom("");
    setBrand("");
    setType("split");
    setAdding(false);
  };

  const remove = (unitId: string) => {
    onUpdate({ ...client, equipment: client.equipment.filter((u) => u.id !== unitId) });
  };

  return (
    <div className="p-4 space-y-2">
      {client.equipment.length === 0 && !adding && (
        <div className="text-center text-[13px] text-gray-500 py-6">
          Кондиционеров пока нет
        </div>
      )}
      {client.equipment.map((unit) => (
        <div
          key={unit.id}
          className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5"
        >
          <div>
            <div className="text-[14px] font-semibold text-gray-900">
              {unit.room}
              <span className="text-[11px] font-normal text-gray-500 ml-2">
                {AC_TYPE_LABELS[unit.ac_type]}
              </span>
            </div>
            <div className="text-[12px] text-gray-500">
              {unit.brand || "Бренд не указан"}
              {unit.model && ` · ${unit.model}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => remove(unit.id)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-red-500"
            aria-label="Удалить"
          >
            ✕
          </button>
        </div>
      ))}
      {adding ? (
        <div className="space-y-2 bg-violet-50/50 border border-violet-200 rounded-xl p-3">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Комната (Гостиная, Спальня...)"
            className="w-full h-10 px-3 rounded-lg bg-white border border-gray-200 text-[14px] focus:outline-none focus:ring-1 focus:ring-violet-500"
            autoFocus
          />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Бренд (Daikin, Mitsubishi...)"
            className="w-full h-10 px-3 rounded-lg bg-white border border-gray-200 text-[14px] focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="flex gap-1.5">
            {(Object.entries(AC_TYPE_LABELS) as [ACType, string][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`flex-1 h-9 rounded-lg text-[12px] font-medium transition ${
                  type === k ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 h-10 text-[13px] text-gray-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={add}
              disabled={!room.trim()}
              className="flex-1 h-10 bg-violet-600 text-white rounded-lg text-[13px] font-semibold disabled:bg-gray-300"
            >
              Добавить
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-11 border border-dashed border-gray-300 rounded-xl text-[13px] text-violet-600 font-semibold active:bg-violet-50"
        >
          + Добавить кондиционер
        </button>
      )}
    </div>
  );
}

// ─── Field row primitive ─────────────────────────────────────────────────

function FieldRow({
  icon,
  label,
  children,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-3 pb-3">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center text-violet-500 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("select");
        onChange(!on);
      }}
      className={`w-11 h-6 rounded-full relative transition-colors ${
        on ? "bg-red-500" : "bg-gray-300"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function GroupsPicker({
  active,
  onChange,
}: {
  active: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    haptic("tap");
    onChange(active.includes(id) ? active.filter((t) => t !== id) : [...active, id]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_GROUPS.map((g) => {
        const on = active.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
              on ? g.class : "bg-gray-100 text-gray-500"
            }`}
          >
            {on && "✓ "}
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

const PRESET_GROUPS = [
  { id: "tag-vip", label: "VIP", class: "bg-amber-100 text-amber-700" },
  { id: "tag-regular", label: "Постоянный", class: "bg-purple-100 text-purple-700" },
  { id: "tag-b2b", label: "B2B", class: "bg-blue-100 text-blue-700" },
  { id: "tag-problem", label: "Проблемный", class: "bg-red-100 text-red-700" },
  { id: "tag-new", label: "Новый", class: "bg-green-100 text-green-700" },
  { id: "tag-referral", label: "Рекомендация", class: "bg-gray-200 text-gray-700" },
];

// ─── Date helpers ────────────────────────────────────────────────────────

function formatRu(ymd: string) {
  // "2026-04-02" → "02.04.2026"
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function weekdayRu(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "short" });
}

function formatRuLong(dt: Date) {
  const d = dt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${d} г. ${t}`;
}

// ─── Icons ───────────────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function IconComment() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}
function IconMoney() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M15 9a3 3 0 00-3-3H11a3 3 0 000 6h2a3 3 0 010 6H9" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    </svg>
  );
}
function IconPercent() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
function IconCake() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21V10a2 2 0 00-2-2H6a2 2 0 00-2 2v11" />
      <path d="M4 16c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1" />
      <path d="M12 6V2M10 4l2-2 2 2" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconCity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
    </svg>
  );
}
function IconHouse() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconBlock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export type { ClientPanelProps };
