"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone as PhoneIcon,
  MessageSquare,
  CalendarPlus,
  MessageCircle,
  Send,
  Cake,
  Wallet,
  Wind,
  Clock as ClockIcon,
} from "@babun/shared/icons";
import type { Client, PhoneEntry } from "@babun/shared/local/clients";
import { ACQUISITION_LABELS, type AcquisitionSource } from "@babun/shared/local/clients";
import LocationsSection from "./LocationsSection";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import type { Appointment } from "@babun/shared/local/appointments";
import { getPaidAmount, getDebtAmount, STATUS_LABELS } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { useServices, useTeams } from "@/components/layout/DashboardClientLayout";
import { loadChats, CHANNEL_LABELS, CHANNEL_COLORS, type Chat, type ChatChannel } from "@babun/shared/local/chats";
import { generateId } from "@babun/shared/local/masters";
import { haptic } from "@/lib/haptics";
import {
  whatsappUrl,
  telegramUrl,
  telUrl,
} from "@babun/shared/common/utils/messenger-links";
import { IconUser, IconPhone, IconChat, IconComment, IconClipboard, IconBlock, IconTelegram, IconInstagram, IconWhatsapp } from "./ClientPanelIcons";

interface ClientPanelProps {
  client: Client;
  appointments: Appointment[];
  onUpdate: (updated: Client) => void;
  onClose: () => void;
}

type TabKey = "profile" | "records" | "history" | "reminders";

// Bumpix-style client card (4 tabs to match the reference exactly).
// Profile is a clean vertical form with an A/C-unit section at the
// bottom (Babun-specific domain); Записи is the full list of visits
// with sub-filter chips; История is the visit log (free-form tech
// notes); Центр напоминаний is the SMS queue built from appointments
// with reminders enabled.

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

  // Hero stats — lifetime money, debt, visits, last-visit date.
  const heroStats = useMemo(() => {
    let lifetime = 0;
    let debt = 0;
    let lastDate = "";
    for (const a of clientApts) {
      if (a.status !== "completed") continue;
      const paid = getPaidAmount(a);
      lifetime += paid;
      debt += Math.max(0, a.total_amount - paid);
      if (a.date > lastDate) lastDate = a.date;
    }
    return {
      visits: clientApts.filter((a) => a.status === "completed").length,
      lifetime: Math.round(lifetime),
      debt: Math.round(debt),
      lastDate,
    };
  }, [clientApts]);

  const update = <K extends keyof Client>(key: K, value: Client[K]) => {
    onUpdate({ ...client, [key]: value });
  };

  // Refs hold the latest client/onUpdate so the effect below can read
  // current values without being triggered by every field change.
  const clientRef = useRef(client);
  clientRef.current = client;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Chats linked to this client are the canonical source for messenger
  // handles — if Dima already chats with them on Telegram, there's no
  // reason to re-type the @username. Runs once per client selection;
  // non-empty fields are never overwritten (user typing wins).
  useEffect(() => {
    const currentClient = clientRef.current;
    const chats = loadChats().filter((c) => c.client_id === currentClient.id);
    if (chats.length === 0) return;
    const patch: Partial<Client> = {};
    for (const chat of chats) {
      if (chat.channel === "telegram" && !currentClient.telegram_username && chat.contact_handle) {
        patch.telegram_username = chat.contact_handle;
      }
      if (chat.channel === "instagram" && !currentClient.instagram_username && chat.contact_handle) {
        patch.instagram_username = chat.contact_handle;
      }
      if (chat.channel === "whatsapp" && !currentClient.whatsapp_phone && chat.contact_phone && chat.contact_phone !== currentClient.phone) {
        patch.whatsapp_phone = chat.contact_phone;
      }
      if (!currentClient.phone && chat.contact_phone) {
        patch.phone = chat.contact_phone;
      }
    }
    if (Object.keys(patch).length > 0) {
      onUpdateRef.current({ ...currentClient, ...patch });
    }
  }, [client.id]); // triggers once per client selection; reads latest values from refs

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

  // v327 — collapse tabs to two: «Профиль» (default) and «Активность».
  // Activity is a single timeline that shows visits, history and
  // reminders together, sorted by date.  Empty state replaces the
  // four-zero placeholder we had before.  Reminders Center is folded
  // into Activity automatically.
  const totalActivity =
    recordsCount + completedApts.length + remindersCount;

  return (
    <div className="flex flex-col bg-[var(--surface-card)]">
      {/* Hero card — avatar, name, city + source, key stats */}
      <ClientHero client={client} stats={heroStats} />

      {/* Tabs bar — compact two-tab segmented control */}
      <div className="flex border-b border-[var(--separator)] bg-[var(--surface-card)] sticky top-0 z-10">
        <TabBtn label="Профиль" active={tab === "profile"} onClick={() => setTab("profile")} />
        <TabBtn
          label={
            totalActivity > 0
              ? `Активность · ${totalActivity}`
              : "Активность"
          }
          active={tab !== "profile"}
          onClick={() => setTab("records")}
        />
      </div>

      {/* Content */}
      <div className="flex-1">
        {tab === "profile" && (
          <ProfileForm client={client} update={update} onUpdate={onUpdate} />
        )}
        {tab !== "profile" && (
          <ActivityTab
            client={client}
            apts={clientApts}
            servicesById={servicesById}
            teamsById={teamsById}
          />
        )}
      </div>
    </div>
  );
}

// v327 — Unified activity timeline.  Replaces the three sparse tabs
// (Записи / История / Центр напоминаний) with a single chronological
// list. Visits, completed work and pending SMS reminders all flow
// here in one pane.  Empty state shows a friendly hint with the
// most useful next action ("Записать клиента →").
function ActivityTab({
  client,
  apts,
  servicesById,
  teamsById,
}: {
  client: Client;
  apts: Appointment[];
  servicesById: Map<string, string>;
  teamsById: Map<string, { name: string; color?: string }>;
}) {
  const router = useRouter();
  if (apts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-8 py-10 gap-3">
        <div className="w-14 h-14 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
          <CalendarPlus size={26} strokeWidth={2} />
        </div>
        <div className="text-[15px] font-semibold text-[var(--label)]">
          Пока нет записей
        </div>
        <div className="text-[13px] text-[var(--label-secondary)] max-w-[260px] leading-snug">
          Запиши клиента — визиты, оплаты и напоминания будут видны
          здесь.
        </div>
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            router.push(`/dashboard?new=1&client_id=${client.id}`);
          }}
          className="mt-1 h-10 px-4 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-spring"
        >
          + Записать
        </button>
      </div>
    );
  }
  return (
    <RecordsTab
      items={apts}
      servicesById={servicesById}
      teamsById={teamsById}
    />
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
          ? "text-[var(--accent)] border-[var(--accent)]"
          : "text-[var(--label-secondary)] border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Profile form ────────────────────────────────────────────────────────
//
// Минималистичная карточка клиента. Всё, что относится к конкретному
// визиту — адрес, тип объекта, город, сумма, скидка — живёт в записи,
// а не в профиле. У одного клиента может быть несколько объектов, и
// хранить «единый адрес» у клиента было бы ложью. На профиле остаётся
// только то, что описывает САМОГО человека.

function ProfileForm({
  client,
  update,
  onUpdate,
}: {
  client: Client;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
  onUpdate: (next: Client) => void;
}) {
  // v321 — reordered: identity → contact → objects → activity → meta.
  // Locations come above PersonalSection because for HVAC the object
  // is the principal entity (one client / many villas).
  return (
    <div className="divide-y divide-[var(--separator)]">
      <FieldRow icon={<IconUser />} label="Имя и фамилия">
        <input
          type="text"
          value={client.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          className="w-full bg-transparent text-[15px] text-[var(--label)] focus:outline-none"
        />
      </FieldRow>

      <PhonesSection client={client} update={update} />

      <MessengersSection client={client} update={update} />

      <LocationsSection client={client} onUpdate={onUpdate} />

      <ContactSourcesSection clientId={client.id} />

      <PersonalSection client={client} update={update} />

      <ClientNotesSection client={client} update={update} />

      <FieldRow icon={<IconComment />} label="Заметки">
        <AutoGrowTextarea
          value={client.comment}
          onChange={(v) => update("comment", v)}
          placeholder="Заметки о клиенте: язык, предпочтения, особенности..."
        />
      </FieldRow>

      <FieldRow icon={<IconClipboard />} label="Группы">
        <GroupsPicker
          active={client.tag_ids}
          onChange={(next) => update("tag_ids", next)}
        />
      </FieldRow>

      <details className="px-4 py-3">
        <summary className="text-[13px] font-medium text-[var(--label-secondary)] list-none cursor-pointer flex items-center justify-between">
          Дополнительно
          <span className="text-[var(--label-quaternary)] text-[12px]">▾</span>
        </summary>
        <div className="mt-3 divide-y divide-[var(--separator)]">
          <FieldRow icon={<IconChat />} label="Обращение в SMS напоминаниях">
            <input
              type="text"
              value={client.sms_name}
              onChange={(e) => update("sms_name", e.target.value)}
              placeholder={client.full_name.split(" ")[0] || "Имя"}
              className="w-full bg-transparent text-[15px] text-[var(--label)] focus:outline-none"
            />
          </FieldRow>

          <FieldRow
            icon={<IconBlock />}
            label="Чёрный список"
            right={
              <Toggle
                on={client.blacklisted}
                onChange={(on) => update("blacklisted", on)}
              />
            }
          >
            {client.blacklisted ? (
              <div className="text-[13px] text-[var(--system-red)] font-semibold">
                Клиент заблокирован
              </div>
            ) : (
              <div className="text-[13px] text-[var(--label-tertiary)]">—</div>
            )}
          </FieldRow>
        </div>
      </details>
    </div>
  );
}

// ─── Phones (multiple) ──────────────────────────────────────────────────
// Primary phone lives at client.phone — search, list display and the
// sticky action bar all read from it. Additional phones (супруг/а,
// арендатор, помощник, WhatsApp на другой номер) go into client.phones.
//
// P2 #36 (CRM Core brief) — Babun обслуживает сервисные бизнесы (HVAC,
// сантехника, клининг). «Жена/Муж» из салонной лексики заменено на
// нейтральные «Супруг(а)/Арендатор/Помощник», которые покрывают
// реальные кейсы выезда (квартира арендатора, муж/жена на месте,
// управляющий объектом).

const PHONE_LABEL_OPTIONS = [
  "Основной",
  "WhatsApp",
  "Супруг(а)",
  "Арендатор",
  "Помощник",
  "Рабочий",
  "Домашний",
  "Другое",
];

function PhonesSection({
  client,
  update,
}: {
  client: Client;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
}) {
  const addPhone = () => {
    haptic("tap");
    const entry: PhoneEntry = {
      id: generateId("ph"),
      number: "",
      label: "Дополнительный",
    };
    update("phones", [...client.phones, entry]);
  };

  const updatePhone = (id: string, patch: Partial<PhoneEntry>) => {
    update(
      "phones",
      client.phones.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const removePhone = (id: string) => {
    haptic("tap");
    update("phones", client.phones.filter((p) => p.id !== id));
  };

  return (
    <div className="px-4 pt-2 pb-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-[var(--label-secondary)]">Телефоны</div>
        <span className="text-[11px] text-[var(--label-tertiary)]">
          супруг(а), арендатор, помощник — на этой же карточке
        </span>
      </div>
      <PhoneRow
        number={client.phone}
        label="Основной"
        onNumberChange={(v) => update("phone", v)}
        primary
      />
      {client.phones.map((p) => (
        <PhoneRow
          key={p.id}
          number={p.number}
          label={p.label}
          name={p.name ?? ""}
          onNumberChange={(v) => updatePhone(p.id, { number: v })}
          onLabelChange={(v) => updatePhone(p.id, { label: v })}
          onNameChange={(v) => updatePhone(p.id, { name: v })}
          onRemove={() => removePhone(p.id)}
        />
      ))}
      <button
        type="button"
        onClick={addPhone}
        className="w-full h-8 border border-dashed border-[var(--separator)] rounded-lg text-[12px] text-[var(--accent)] font-semibold active:bg-[var(--accent-tint)]"
      >
        + Добавить номер
      </button>
    </div>
  );
}

function PhoneRow({
  number,
  label,
  name,
  onNumberChange,
  onLabelChange,
  onNameChange,
  onRemove,
  primary,
}: {
  number: string;
  label: string;
  name?: string;
  onNumberChange: (v: string) => void;
  onLabelChange?: (v: string) => void;
  onNameChange?: (v: string) => void;
  onRemove?: () => void;
  primary?: boolean;
}) {
  const digits = number.replace(/\D/g, "");
  const showNameInput = !primary && Boolean(onNameChange);
  return (
    <div className="bg-[var(--fill-tertiary)] rounded-lg px-2 py-1.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="text-[var(--accent)] shrink-0">
          <IconPhone />
        </div>
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="+357..."
          className="w-[38%] min-w-0 bg-transparent text-[14px] text-[var(--label)] tabular-nums focus:outline-none"
        />
        {primary ? (
          <span className="text-[12px] text-[var(--label-secondary)] px-1 shrink-0">{label}</span>
        ) : (
          <select
            value={label}
            onChange={(e) => onLabelChange?.(e.target.value)}
            className="min-w-0 flex-1 h-7 bg-[var(--surface-card)] border border-[var(--separator)] rounded text-[12px] text-[var(--label)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] px-1"
          >
            {PHONE_LABEL_OPTIONS.concat(
              PHONE_LABEL_OPTIONS.includes(label) ? [] : [label]
            ).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        {digits && (
          <>
            <a
              href={`tel:${digits}`}
              aria-label="Позвонить"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(52,199,89,0.14)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.24)] shrink-0"
            >
              <IconPhone />
            </a>
            <a
              href={`sms:${digits}`}
              aria-label="Отправить SMS"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(62,136,247,0.14)] text-[var(--system-blue)] active:bg-[rgba(62,136,247,0.24)] shrink-0"
            >
              <IconChat />
            </a>
          </>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить номер"
            className="w-7 h-7 flex items-center justify-center text-[var(--label-tertiary)] active:text-[var(--system-red)] shrink-0"
          >
            ✕
          </button>
        )}
      </div>
      {showNameInput && (
        <input
          type="text"
          value={name ?? ""}
          onChange={(e) => onNameChange?.(e.target.value)}
          placeholder="Имя контакта (например, «Мария»)"
          className="w-full h-7 px-2 bg-[var(--surface-card)] border border-[var(--separator)] rounded text-[12px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          maxLength={60}
        />
      )}
    </div>
  );
}

// ─── Messenger handles ──────────────────────────────────────────────────

function MessengersSection({
  client,
  update,
}: {
  client: Client;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
}) {
  // v327 — show only filled messenger handles + a single «+ Добавить»
  // expander.  Empty placeholder rows for Telegram/Instagram cluttered
  // the card when the client only used WhatsApp.  WhatsApp default-
  // phone row is hidden too (the Hero already has WhatsApp button).
  const [showAll, setShowAll] = useState(false);
  const tg = client.telegram_username.replace(/^@/, "");
  const ig = client.instagram_username.replace(/^@/, "");
  const waDigits = (client.whatsapp_phone || "").replace(/\D/g, "");
  const hasTg = !!client.telegram_username.trim();
  const hasIg = !!client.instagram_username.trim();
  const hasWa = !!client.whatsapp_phone.trim();
  const filled = [hasTg, hasIg, hasWa].filter(Boolean).length;
  const expand = showAll || filled > 0;

  return (
    <div className="px-4 pt-2 pb-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-[var(--label-secondary)]">Мессенджеры</div>
        {expand && filled < 3 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[11px] font-semibold text-[var(--accent)] active:opacity-70"
          >
            + ещё
          </button>
        )}
      </div>

      {!expand ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full h-11 flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--separator)] text-[13px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
        >
          + Telegram / Instagram / WhatsApp
        </button>
      ) : (
        <>
          {(hasTg || showAll) && (
            <MessengerRow
              icon={<IconTelegram />}
              color="bg-[rgba(62,136,247,0.14)] text-[var(--system-blue)]"
              label="Telegram"
              value={client.telegram_username}
              placeholder="@username"
              onChange={(v) => update("telegram_username", v)}
              openUrl={tg ? `https://t.me/${tg}` : undefined}
            />
          )}
          {(hasIg || showAll) && (
            <MessengerRow
              icon={<IconInstagram />}
              color="bg-pink-100 text-pink-600"
              label="Instagram"
              value={client.instagram_username}
              placeholder="@username"
              onChange={(v) => update("instagram_username", v)}
              openUrl={ig ? `https://instagram.com/${ig}` : undefined}
            />
          )}
          {(hasWa || showAll) && (
            <MessengerRow
              icon={<IconWhatsapp />}
              color="bg-[rgba(52,199,89,0.14)] text-[var(--system-green)]"
              label="WhatsApp"
              value={client.whatsapp_phone}
              placeholder="отдельный номер для WhatsApp"
              onChange={(v) => update("whatsapp_phone", v)}
              openUrl={waDigits ? `https://wa.me/${waDigits}` : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}

function MessengerRow({
  icon,
  color,
  label,
  value,
  placeholder,
  onChange,
  openUrl,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  openUrl?: string;
  /** legacy, kept for call-site compat */
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-[var(--fill-tertiary)] rounded-lg px-2 py-1.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color}`} aria-label={label}>
        {icon}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--label)] focus:outline-none"
      />
      {openUrl && (
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="h-7 px-2.5 rounded-md bg-[var(--surface-card)] border border-[var(--separator)] text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)] flex items-center shrink-0"
        >
          Открыть
        </a>
      )}
    </div>
  );
}

// ─── Where the client contacted us from ─────────────────────────────────

function ContactSourcesSection({ clientId }: { clientId: string }) {
  // Chats live in localStorage — load on mount, refresh on focus so a
  // freshly linked chat shows up without reopening the card.
  const [chats, setChats] = useState<Chat[]>([]);
  useEffect(() => {
    const refresh = () => setChats(loadChats());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const linked = useMemo(
    () => chats.filter((c) => c.client_id === clientId),
    [chats, clientId]
  );

  if (linked.length === 0) return null;

  return (
    <div className="px-4 pt-2 pb-2">
      <div className="text-[12px] text-[var(--label-secondary)] mb-1">Где связывался</div>
      <div className="flex flex-wrap gap-1">
        {linked.map((chat) => (
          <a
            key={chat.id}
            // Pass the *specific* chat id — the chats page activates
            // exactly that conversation, not just the first one for this
            // client. Lets Dima jump from the card straight into the
            // Instagram / WhatsApp / Telegram thread.
            href={`/dashboard/chats?chat_id=${chat.id}`}
            className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-semibold text-[var(--label-on-accent)] active:scale-[0.98]"
            style={{ background: CHANNEL_COLORS[chat.channel as ChatChannel] || "#8b5cf6" }}
          >
            <ChannelGlyph channel={chat.channel as ChatChannel} />
            {CHANNEL_LABELS[chat.channel as ChatChannel]}
          </a>
        ))}
      </div>
    </div>
  );
}

function ChannelGlyph({ channel }: { channel: ChatChannel }) {
  switch (channel) {
    case "whatsapp":
      return <IconWhatsapp />;
    case "instagram":
      return <IconInstagram />;
    case "telegram":
      return <IconTelegram />;
    case "sms":
      return <IconChat />;
    default:
      return <IconChat />;
  }
}

// Grows with its content so мастера-«писатели» не зажаты в 2 строки.
// Uses ref-based height sync; onInput updates as the user types.
function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const ref = useAutoGrow(value);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className="w-full bg-transparent text-[15px] text-[var(--label)] focus:outline-none resize-none leading-snug"
    />
  );
}

function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);
  return ref;
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
      <div className="flex overflow-x-auto border-b border-[var(--separator)] bg-[var(--accent)]">
        {RECORD_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                active ? "text-[var(--label-on-accent)]" : "text-white/60"
              }`}
            >
              {f.label} ({counts[f.key]})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[var(--label-secondary)]">
          Записей нет
        </div>
      ) : (
        <div className="divide-y divide-[var(--separator)]">
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

  // v680 / Audit-2026-05-21 P0-4 — some legacy / seed appointments
  // carry the service name in apt.comment as well as in apt.services.
  // The card then rendered the same string twice on consecutive lines
  // («Сплит-система 7-9 BTU / Сплит-система 7-9 BTU»). Suppress the
  // comment row when its trimmed value matches any rendered service
  // name — the service line above already conveys it. Real comments
  // («домофон 25, синяя дверь, собака») still show fine because they
  // won't match a catalog name.
  const renderedNames = new Set(
    Array.from(quantities.keys()).map((id) => servicesById.get(id) ?? "Услуга"),
  );
  const commentTrimmed = (apt.comment ?? "").trim();
  const commentRedundant =
    commentTrimmed.length > 0 && renderedNames.has(commentTrimmed);
  const visibleComment = commentRedundant ? "" : commentTrimmed;

  const bg =
    apt.status === "completed"
      ? "bg-[rgba(52,199,89,0.08)]"
      : apt.status === "cancelled"
      ? "bg-[var(--fill-tertiary)]"
      : apt.status === "in_progress"
      ? "bg-[var(--accent-tint)]"
      : "bg-[rgba(62,136,247,0.08)]";

  return (
    <div className={`${bg} px-4 py-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] text-[var(--label)]">
          {formatRu(apt.date)} {apt.time_start}, {weekdayRu(apt.date)}
        </div>
        <div className="text-[12px] font-semibold text-[var(--label-secondary)] shrink-0">
          {STATUS_LABELS[apt.status]}
        </div>
      </div>
      {team && (
        <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: team.color || "#8b5cf6" }}
          />
          {/* P0 #4 (CRM Core brief): the value is the team name, so the
              label was «Мастер: Бригада X» — a lie. Individual masters
              are tracked separately and aren't surfaced here yet. */}
          Команда: {team.name}
        </div>
      )}
      {(serviceSummary || visibleComment) && (
        <div className="text-[13px] text-[var(--label)] mt-1 whitespace-pre-wrap break-words">
          {serviceSummary}
          {serviceSummary && visibleComment ? "\n" : ""}
          {visibleComment}
        </div>
      )}
      {/* Payment row — P0 #12 (CRM Core brief). Bare colored dots with
          numbers were unreadable («0 / 150 / 150» without legend). Now
          each amount is currency-formatted and carries an inline label
          + tooltip. Debt is hidden when zero so a fully-paid visit
          doesn't show a meaningless «€0 к оплате». */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] tabular-nums">
        <span
          className="inline-flex items-center gap-1 text-[var(--system-green)]"
          title="Оплачено"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--system-green)]" />
          <span className="font-semibold">{formatEUR(paid)}</span>
          <span className="text-[var(--label-secondary)] font-normal">
            оплачено
          </span>
        </span>
        {debt > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[var(--system-red)]"
            title="К оплате"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--system-red)]" />
            <span className="font-semibold">{formatEUR(debt)}</span>
            <span className="text-[var(--label-secondary)] font-normal">
              к оплате
            </span>
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 text-[var(--system-blue)]"
          title="Итого"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--system-blue)]" />
          <span className="font-semibold">{formatEUR(total)}</span>
          <span className="text-[var(--label-secondary)] font-normal">
            итого
          </span>
        </span>
      </div>
    </div>
  );
}


// ─── Field row primitive ─────────────────────────────────────────────────

// ─── Personal info (city / birthday / email / source / language) ───

const ACQ_ORDER: AcquisitionSource[] = [
  "referral",
  "instagram",
  "whatsapp",
  "google_maps",
  "website",
  "repeat",
  "walk_in",
  "other",
  "unknown",
];

const LANGUAGE_PRESETS = ["ru", "en", "el"];
const LANGUAGE_LABELS: Record<string, string> = {
  ru: "Русский",
  en: "English",
  el: "Ελληνικά",
};

function PersonalSection({
  client,
  update,
}: {
  client: Client;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
}) {
  // v327 — render only fields with data; if everything is empty,
  // collapse the whole section behind a single «+ Заполнить» pill.
  const [showAll, setShowAll] = useState(false);
  const hasCity = !!client.city?.trim();
  const hasBirthday = !!client.birthday;
  const hasEmail = !!client.email?.trim();
  const hasLang = !!client.language;
  const hasSource =
    !!client.acquisition_source && client.acquisition_source !== "unknown";
  const filledCount = [hasCity, hasBirthday, hasEmail, hasLang, hasSource]
    .filter(Boolean).length;
  const expand = showAll || filledCount > 0;

  return (
    <div className="px-4 pt-3 pb-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Личное
        </div>
        {expand && filledCount < 5 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[11px] font-semibold text-[var(--accent)] active:opacity-70"
          >
            + ещё
          </button>
        )}
      </div>

      {!expand ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full h-11 flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--separator)] text-[13px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
        >
          + Город / ДР / Email / Язык
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(hasCity || showAll) && (
              <CompactField label="Город">
                <input
                  type="text"
                  value={client.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Пафос"
                  className="w-full bg-transparent text-[14px] text-[var(--label)] focus:outline-none"
                  maxLength={60}
                />
              </CompactField>
            )}
            {(hasBirthday || showAll) && (
              <CompactField label="День рождения">
                <input
                  type="date"
                  value={client.birthday}
                  onChange={(e) => update("birthday", e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[var(--label)] focus:outline-none tabular-nums"
                />
              </CompactField>
            )}
            {(hasEmail || showAll) && (
              <CompactField label="Email">
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-transparent text-[14px] text-[var(--label)] focus:outline-none"
                  maxLength={120}
                />
              </CompactField>
            )}
            {(hasLang || showAll) && (
              <CompactField label="Язык">
                <div className="flex gap-1">
                  {LANGUAGE_PRESETS.map((l) => {
                    const active = (client.language ?? "") === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => update("language", active ? "" : l)}
                        className={`px-2 h-6 rounded-full text-[11px] font-semibold transition active:scale-[0.97] ${
                          active
                            ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                            : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                        }`}
                      >
                        {LANGUAGE_LABELS[l]}
                      </button>
                    );
                  })}
                </div>
              </CompactField>
            )}
          </div>
          {(hasSource || showAll) && (
            <CompactField label="Источник обращения">
              <select
                value={client.acquisition_source}
                onChange={(e) =>
                  update(
                    "acquisition_source",
                    e.target.value as AcquisitionSource,
                  )
                }
                className="w-full bg-transparent text-[14px] text-[var(--label)] focus:outline-none"
              >
                {ACQ_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {ACQUISITION_LABELS[s]}
                  </option>
                ))}
              </select>
            </CompactField>
          )}
        </>
      )}
    </div>
  );
}

function CompactField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-[10px] bg-[var(--fill-tertiary)] min-h-[46px]">
      <span className="text-[10px] uppercase tracking-wider text-[var(--label-tertiary)] font-semibold">
        {label}
      </span>
      <div className="text-[14px] text-[var(--label)] flex items-center min-h-[20px]">
        {children}
      </div>
    </label>
  );
}

// ─── Dated client notes (separate from textarea «Комментарий») ──────

const NOTE_PRESETS = [
  "Звонок",
  "Встреча",
  "Жалоба",
  "Допродажа",
  "Просто заметка",
];

function ClientNotesSection({
  client,
  update,
}: {
  client: Client;
  update: <K extends keyof Client>(key: K, value: Client[K]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [tag, setTag] = useState(NOTE_PRESETS[0]);
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const notes = (client.notes ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const cancel = () => {
    setAdding(false);
    setText("");
    setTag(NOTE_PRESETS[0]);
    setDate(new Date().toISOString().slice(0, 10));
  };

  const save = () => {
    if (!text.trim()) return;
    haptic("tap");
    const stamp = new Date(date);
    if (Number.isNaN(stamp.getTime())) return;
    const created_at = stamp.toISOString();
    const next = [
      ...(client.notes ?? []),
      {
        id: generateId("note"),
        text: `[${tag}] ${text.trim()}`,
        created_at,
      },
    ];
    update("notes", next);
    cancel();
  };

  const remove = (id: string) => {
    haptic("warning");
    update("notes", (client.notes ?? []).filter((n) => n.id !== id));
  };

  return (
    <div className="px-4 pt-3 pb-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Заметки
        </div>
        <span className="text-[11px] text-[var(--label-tertiary)]">
          датированный лог: звонки, встречи, особенности
        </span>
      </div>

      {notes.length === 0 && !adding && (
        <div className="text-[13px] text-[var(--label-tertiary)] py-1">
          Пока пусто.
        </div>
      )}

      {notes.map((n) => {
        const ts = new Date(n.created_at);
        const dateLabel = ts.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return (
          <div
            key={n.id}
            className="flex items-start gap-2 px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)]"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--label-tertiary)] tabular-nums">
                {dateLabel}
              </div>
              <div className="text-[13px] text-[var(--label)] leading-snug whitespace-pre-wrap">
                {n.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(n.id)}
              aria-label="Удалить заметку"
              className="w-6 h-6 flex items-center justify-center text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)] rounded-full shrink-0"
            >
              ✕
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-[10px] bg-[var(--fill-tertiary)] p-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {NOTE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTag(p)}
                className={`px-2 h-6 rounded-full text-[11px] font-semibold transition ${
                  tag === p
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--surface-card)] text-[var(--label)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 px-2.5 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] focus:outline-none tabular-nums"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что произошло…"
            rows={2}
            maxLength={400}
            className="w-full px-3 py-2 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!text.trim()}
              className="flex-1 h-9 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-9 px-3 rounded-full bg-[var(--surface-card)] text-[var(--label)] text-[13px] press-scale"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-8 border border-dashed border-[var(--separator)] rounded-lg text-[12px] text-[var(--accent)] font-semibold active:bg-[var(--accent-tint)]"
        >
          + Добавить заметку
        </button>
      )}
    </div>
  );
}

// ─── Client hero card (top of profile) ──────────────────────────────

// v321 — Reworked Client Hero.
//   * Avatar with optional gradient ring (VIP / blacklist).
//   * Smart Insights pill — single actionable hint at a time
//     (debt, birthday, silence, HVAC season).
//   * Quick action row — 5 round buttons (Call · WA · SMS · Book · Chat).
//   * Stat grid only when there's something to show (≥1 visit OR
//     lifetime > 0 OR debt > 0).
function ClientHero({
  client,
  stats,
}: {
  client: Client;
  stats: { visits: number; lifetime: number; debt: number; lastDate: string };
}) {
  const router = useRouter();
  const color = getAvatarColor(client.full_name);

  const hasStats =
    stats.visits > 0 ||
    stats.lifetime > 0 ||
    stats.debt > 0 ||
    !!stats.lastDate;

  const insight = useMemo(
    () => buildInsight(client, stats),
    [client, stats]
  );

  const tel = telUrl(client.phone);
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);
  const tg = telegramUrl(client.telegram_username, client.phone);

  const isVip = client.tag_ids?.some((t) => /vip/i.test(t)) ?? false;

  return (
    <div className="px-4 pt-3 pb-3 bg-gradient-to-b from-[var(--accent-tint)] to-transparent">
      <div className="flex items-center gap-3">
        {isVip ? (
          <div className="avatar-ring shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-bold text-[18px]"
              style={{ backgroundColor: color }}
            >
              {getInitials(client.full_name || "?")}
            </div>
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-bold text-[18px] shrink-0"
            style={{ backgroundColor: color }}
          >
            {getInitials(client.full_name || "?")}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[20px] font-semibold text-[var(--label)] tracking-tight truncate">
            {client.full_name || "Без имени"}
          </div>
          <ProfileChips client={client} />
        </div>
      </div>

      {/* Quick action row — 5 round 44px buttons.  Each button hides
          itself when the corresponding link can't be built (no phone,
          no Telegram handle, etc.). */}
      <div className="mt-3 grid grid-cols-5 gap-1">
        <QuickAction
          icon={<PhoneIcon size={18} strokeWidth={2.2} />}
          label="Звонок"
          tone="green"
          href={tel}
        />
        <QuickAction
          icon={<MessageSquare size={18} strokeWidth={2.2} />}
          label="SMS"
          tone="blue"
          href={tel ? `sms:${client.phone.replace(/\D/g, "")}` : null}
        />
        <QuickAction
          icon={<Send size={18} strokeWidth={2.2} />}
          label="WhatsApp"
          tone="green"
          href={wa}
          external
        />
        <QuickAction
          icon={<CalendarPlus size={18} strokeWidth={2.2} />}
          label="Записать"
          tone="accent"
          onClick={() => {
            haptic("tap");
            router.push(`/dashboard?new=1&client_id=${client.id}`);
          }}
        />
        <QuickAction
          icon={<MessageCircle size={18} strokeWidth={2.2} />}
          label="Чат"
          tone="indigo"
          onClick={() => {
            haptic("tap");
            router.push(`/dashboard/chats?client_id=${client.id}`);
          }}
        />
      </div>

      {insight && <InsightPill {...insight} />}

      {hasStats && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <HeroStat
            label="Визитов"
            value={String(stats.visits)}
            tone="default"
          />
          <HeroStat
            label="Доход"
            value={
              stats.lifetime > 0
                ? `€${stats.lifetime.toLocaleString("ru-RU")}`
                : "—"
            }
            tone={stats.lifetime > 0 ? "good" : "default"}
          />
          <HeroStat
            label="Долг"
            value={stats.debt > 0 ? `€${stats.debt}` : "—"}
            tone={stats.debt > 0 ? "bad" : "default"}
          />
          <HeroStat
            label="Последний"
            value={stats.lastDate ? formatDateShort(stats.lastDate) : "—"}
            tone="default"
          />
        </div>
      )}
      {tg && (
        <a
          href={tg}
          target="_blank"
          rel="noreferrer"
          onClick={() => haptic("tap")}
          className="hidden"
        >
          tg
        </a>
      )}
    </div>
  );
}

// Compact city / language / source / source-tag chips under the name.
// Keeps the hero from looking empty when only minimal data is filled.
function ProfileChips({ client }: { client: Client }) {
  const chips: { icon?: string; text: string }[] = [];
  if (client.city?.trim()) chips.push({ icon: "📍", text: client.city.trim() });
  if (client.language) {
    const flag =
      client.language === "ru"
        ? "🇷🇺"
        : client.language === "en"
          ? "🇬🇧"
          : client.language === "el"
            ? "🇬🇷"
            : "";
    chips.push({ text: flag || client.language });
  }
  if (client.acquisition_source && client.acquisition_source !== "unknown") {
    chips.push({
      text: ACQUISITION_LABELS[
        client.acquisition_source as AcquisitionSource
      ],
    });
  }
  if (chips.length === 0) {
    return (
      <div className="text-[12px] text-[var(--label-tertiary)] truncate mt-0.5">
        Заполните профиль ниже
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 text-[12px] text-[var(--label-secondary)]"
        >
          {c.icon && <span>{c.icon}</span>}
          <span className="truncate">{c.text}</span>
          {i < chips.length - 1 && (
            <span className="text-[var(--label-quaternary)] ml-1">·</span>
          )}
        </span>
      ))}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  tone,
  href,
  external,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "blue" | "accent" | "indigo";
  href?: string | null;
  external?: boolean;
  onClick?: () => void;
}) {
  const enabled = !!href || !!onClick;
  const toneCls = !enabled
    ? "text-[var(--label-quaternary)] bg-[var(--fill-tertiary)]"
    : tone === "green"
      ? "text-[var(--system-green)] bg-[rgba(52,199,89,0.12)] active:bg-[rgba(52,199,89,0.20)]"
      : tone === "blue"
        ? "text-[var(--system-blue)] bg-[rgba(0,122,255,0.10)] active:bg-[rgba(0,122,255,0.18)]"
        : tone === "indigo"
          ? "text-[var(--system-indigo)] bg-[rgba(94,92,230,0.10)] active:bg-[rgba(94,92,230,0.18)]"
          : "text-[var(--accent)] bg-[var(--accent-tint)] active:bg-[var(--accent-tint)]";

  const inner = (
    <>
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center transition press-scale ${toneCls}`}
      >
        {icon}
      </span>
      <span
        className={`text-[10px] font-medium leading-none ${
          enabled ? "text-[var(--label-secondary)]" : "text-[var(--label-quaternary)]"
        }`}
      >
        {label}
      </span>
    </>
  );

  const baseProps = {
    className: "flex flex-col items-center gap-1 py-1",
    onClick: () => {
      if (!enabled) return;
      haptic("tap");
      onClick?.();
    },
  } as const;

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        {...baseProps}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" disabled={!enabled} {...baseProps}>
      {inner}
    </button>
  );
}

interface Insight {
  tone: "warn" | "info" | "good";
  icon: React.ReactNode;
  text: string;
}

// Picks one insight to surface — order is by severity (debt > silence
// > seasonal > birthday).  Returns null if nothing actionable.
function buildInsight(
  client: Client,
  stats: { visits: number; lifetime: number; debt: number; lastDate: string }
): Insight | null {
  if (stats.debt > 0) {
    return {
      tone: "warn",
      icon: <Wallet size={14} strokeWidth={2.2} />,
      text: `Долг €${stats.debt} — стоит позвонить`,
    };
  }
  // Birthday in the next 14 days?
  if (client.birthday) {
    const days = daysUntilBirthday(client.birthday);
    if (days !== null && days >= 0 && days <= 14) {
      return {
        tone: "info",
        icon: <Cake size={14} strokeWidth={2.2} />,
        text:
          days === 0
            ? "День рождения сегодня"
            : days === 1
              ? "День рождения завтра"
              : `День рождения через ${days} дн.`,
      };
    }
  }
  // Silence: completed visits but last one >120 days ago?
  if (stats.lastDate && stats.visits > 0) {
    const ageDays = daysSince(stats.lastDate);
    if (ageDays >= 120) {
      // HVAC season hint: chistka is May / October, suggest accordingly.
      const month = new Date().getMonth();
      const inSeason = month === 4 || month === 9; // May or October
      return {
        tone: "info",
        icon: inSeason ? (
          <Wind size={14} strokeWidth={2.2} />
        ) : (
          <ClockIcon size={14} strokeWidth={2.2} />
        ),
        text: inSeason
          ? `Сезон чистки A/C — ${ageDays} дн. без визита`
          : `${ageDays} дн. без визита — позвонить?`,
      };
    }
  }
  // No visits ever AND record is at least 30d old → cold lead reminder.
  if (stats.visits === 0 && client.created_at) {
    const ageDays = daysSince(client.created_at.slice(0, 10));
    if (ageDays >= 30 && ageDays <= 365) {
      return {
        tone: "info",
        icon: <ClockIcon size={14} strokeWidth={2.2} />,
        text: `${ageDays} дн. в базе — не записан ни разу`,
      };
    }
  }
  return null;
}

function InsightPill({ tone, icon, text }: Insight) {
  const cls =
    tone === "warn"
      ? "bg-[rgba(255,149,0,0.12)] text-[var(--system-orange)]"
      : tone === "good"
        ? "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)]"
        : "bg-[var(--accent-tint)] text-[var(--accent)]";
  return (
    <div
      className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-[12px] text-[13px] font-semibold ${cls}`}
    >
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "good" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? "text-[var(--system-green)]"
      : tone === "bad"
        ? "text-[var(--system-red)]"
        : "text-[var(--label)]";
  return (
    <div className="rounded-[10px] bg-[var(--surface-card)] shadow-[var(--shadow-card)] px-2 py-2">
      <div
        className={`text-[14px] font-bold tabular-nums leading-none ${valueColor}`}
      >
        {value}
      </div>
      <div className="text-[10px] text-[var(--label-tertiary)] uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

function daysSince(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const past = new Date(y, m - 1, d).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - past) / 86400000));
}

function daysUntilBirthday(isoDate: string): number | null {
  const [, m, d] = isoDate.split("-").map(Number);
  if (!m || !d) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), m - 1, d);
  const target =
    thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ? new Date(now.getFullYear() + 1, m - 1, d)
      : thisYear;
  return Math.floor(
    (target.getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000
  );
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

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
    <div className="px-4 pt-2 pb-2">
      <div className="text-[12px] text-[var(--label-secondary)] mb-0.5">{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center text-[var(--accent)] shrink-0">
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
        on ? "bg-[var(--accent)]" : "bg-[var(--fill-primary)]"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-[var(--surface-card)] transition-transform ${
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
  // v327 — by default render only assigned tags + a single "+ Тег"
  // pill that opens the full picker.  The previous version showed
  // every preset tag at once which made it look like a checkbox
  // dump, hard to read, and didn't scale to user-defined tags.
  const [picker, setPicker] = useState(false);
  const toggle = (id: string) => {
    haptic("tap");
    onChange(active.includes(id) ? active.filter((t) => t !== id) : [...active, id]);
  };
  const remove = (id: string) => {
    haptic("warning");
    onChange(active.filter((t) => t !== id));
  };

  if (!picker) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {active.length === 0 ? (
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-dashed border-[var(--separator)] text-[var(--accent)] active:bg-[var(--accent-tint)]"
          >
            + Тег
          </button>
        ) : (
          <>
            {active.map((id) => {
              const g = PRESET_GROUPS.find((x) => x.id === id);
              if (!g) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => remove(id)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-semibold inline-flex items-center gap-1 ${g.class}`}
                  title="Тап — снять"
                >
                  {g.label}
                  <span className="opacity-60 text-[10px]">✕</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-dashed border-[var(--separator)] text-[var(--accent)] active:bg-[var(--accent-tint)]"
            >
              + Тег
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_GROUPS.map((g) => {
          const on = active.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition ${
                on
                  ? g.class
                  : "bg-[var(--fill-primary)] text-[var(--label-secondary)]"
              }`}
            >
              {on && "✓ "}
              {g.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setPicker(false)}
        className="text-[11px] font-semibold text-[var(--accent)] active:opacity-70"
      >
        Готово
      </button>
    </div>
  );
}

const PRESET_GROUPS = [
  { id: "tag-vip", label: "VIP", class: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" },
  { id: "tag-regular", label: "Постоянный", class: "bg-purple-100 text-purple-700" },
  { id: "tag-b2b", label: "B2B", class: "bg-[rgba(62,136,247,0.14)] text-[var(--system-blue)]" },
  { id: "tag-problem", label: "Проблемный", class: "bg-[rgba(255,59,48,0.14)] text-[var(--system-red)]" },
  { id: "tag-new", label: "Новый", class: "bg-[rgba(52,199,89,0.14)] text-[var(--system-green)]" },
  { id: "tag-referral", label: "Рекомендация", class: "bg-[var(--fill-secondary)] text-[var(--label)]" },
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

// ─── Icons ───────────────────────────────────────────────────────────────


export type { ClientPanelProps };
