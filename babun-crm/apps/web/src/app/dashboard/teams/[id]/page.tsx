"use client";

// Sprint 033 — Brigade-as-hub full-page editor.
//
// Replaces the small modal that lived on /dashboard/teams. Seven
// card-style sections stack vertically (user scrolls). Everything a
// brigade "owns" in the app lives here, not in three different places.
//
// Routes:
//   /dashboard/teams/new  → blank brigade + defaults
//   /dashboard/teams/:id  → edit existing brigade

import { use, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2, Check, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useMasters, useTeams, useServices, useAppointments, useCities } from "@/app/dashboard/layout";
import {
  TEAM_COLORS,
  generateId,
  type Master,
  type Team,
} from "@/lib/masters";
import type { Service } from "@/lib/services";

const BLANK_TEAM: Team = {
  id: "",
  name: "",
  region: "",
  color: TEAM_COLORS[0].value,
  default_city: "",
  lead_id: null,
  helper_ids: [],
  payout_percentage: 30,
  active: true,
  created_at: "",
  cities: [],
  default_scroll_time: "",
  calendar_window_start: "",
  calendar_window_end: "",
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadePage({ params }: RouteParams) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const confirm = useConfirm();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const { services, categories, upsertService } = useServices();
  const { appointments, upsertAppointment } = useAppointments();
  const { cities } = useCities();

  // Source of truth — the stored team (for edit) or BLANK_TEAM (for
  // new). Cloned into local form state on mount so unsaved edits
  // aren't written back to context until Save.
  const originalTeam = useMemo<Team>(() => {
    if (isNew) {
      return {
        ...BLANK_TEAM,
        id: generateId("team"),
        created_at: new Date().toISOString(),
      };
    }
    return teams.find((t) => t.id === id) ?? BLANK_TEAM;
  }, [isNew, id, teams]);

  const [draft, setDraft] = useState<Team>(originalTeam);
  const [leadId, setLeadId] = useState<string | null>(originalTeam.lead_id);
  const [helperIds, setHelperIds] = useState<string[]>(originalTeam.helper_ids);

  // If teams list arrives after mount (async hydrate in some cases),
  // rehydrate the draft from the stored team so the form isn't stuck
  // on the blank snapshot.
  useEffect(() => {
    if (!isNew && originalTeam.id && draft.id === "") {
      setDraft(originalTeam);
      setLeadId(originalTeam.lead_id);
      setHelperIds(originalTeam.helper_ids);
    }
  }, [originalTeam, isNew, draft.id]);

  // Not found guard — edit route with an id that's not in the list
  // and isn't "new".
  if (!isNew && !originalTeam.id) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-[17px] font-semibold text-[var(--label)] mb-2">
            Бригада не найдена
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/teams")}
            className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            К списку бригад
          </button>
        </div>
      </div>
    );
  }

  const activeCities = cities.filter((c) => c.isActive);
  const serviceCategories = categories;

  const update = <K extends keyof Team>(key: K, value: Team[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleCity = (cityName: string) => {
    haptic("tap");
    const current = draft.cities ?? [];
    if (current.includes(cityName)) {
      update("cities", current.filter((c) => c !== cityName));
    } else {
      update("cities", [...current, cityName]);
    }
  };

  // Services-to-brigade relation lives on Service.brigade_ids. Toggle
  // flips the brigade's id inside the service record.
  const serviceHasThisBrigade = (svc: Service) =>
    draft.id ? svc.brigade_ids.includes(draft.id) : false;

  const toggleService = (svc: Service) => {
    haptic("tap");
    if (!draft.id) return;
    const has = svc.brigade_ids.includes(draft.id);
    const next: Service = {
      ...svc,
      brigade_ids: has
        ? svc.brigade_ids.filter((bid) => bid !== draft.id)
        : [...svc.brigade_ids, draft.id],
    };
    upsertService(next);
  };

  const toggleHelper = (masterId: string) => {
    haptic("tap");
    if (helperIds.includes(masterId)) {
      setHelperIds(helperIds.filter((id) => id !== masterId));
    } else {
      setHelperIds([...helperIds, masterId]);
    }
  };

  const availableLeads = masters.filter((m) => m.team_id === null || m.team_id === draft.id || m.id === leadId);
  const availableHelpers = masters.filter((m) => m.id !== leadId);

  const handleSave = () => {
    if (!draft.name.trim()) {
      haptic("warning");
      return;
    }
    haptic("tap");

    const saved: Team = {
      ...draft,
      lead_id: leadId,
      helper_ids: helperIds.filter((id) => id !== leadId),
      // Normalize empty strings → undefined so the type matches
      // optional fields rather than being "" forever.
      default_scroll_time: draft.default_scroll_time?.trim() || undefined,
      calendar_window_start: draft.calendar_window_start?.trim() || undefined,
      calendar_window_end: draft.calendar_window_end?.trim() || undefined,
      cities: draft.cities && draft.cities.length > 0 ? draft.cities : undefined,
    };
    upsertTeam(saved);

    // Propagate team_id onto masters per lead+helpers selection.
    const memberIds = new Set<string>();
    if (saved.lead_id) memberIds.add(saved.lead_id);
    saved.helper_ids.forEach((mid) => memberIds.add(mid));
    const updatedMasters = masters.map<Master>((m) => {
      const wasHere = m.team_id === saved.id;
      const nowHere = memberIds.has(m.id);
      if (nowHere && m.team_id !== saved.id) return { ...m, team_id: saved.id };
      if (wasHere && !nowHere) return { ...m, team_id: null };
      return m;
    });
    setMasters(updatedMasters);

    router.push("/dashboard/teams");
  };

  const handleDelete = async () => {
    if (isNew) return;
    const orphanCount = appointments.filter((a) => a.team_id === draft.id).length;
    const ok = await confirm({
      title: `Удалить бригаду «${draft.name}»?`,
      message:
        orphanCount > 0
          ? `У ${orphanCount} записей сбросится привязка к бригаде (team_id будет пустым).`
          : "Эта бригада нигде не используется.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    deleteTeam(draft.id);
    const updatedMasters = masters.map<Master>((m) =>
      m.team_id === draft.id ? { ...m, team_id: null } : m,
    );
    setMasters(updatedMasters);
    for (const apt of appointments) {
      if (apt.team_id === draft.id) {
        upsertAppointment({ ...apt, team_id: null, updated_at: new Date().toISOString() });
      }
    }
    router.push("/dashboard/teams");
  };

  const canSave = draft.name.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      {/* Flat iOS-style nav bar */}
      <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
        <button
          type="button"
          onClick={() => router.push("/dashboard/teams")}
          aria-label="Назад"
          className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center">
          {isNew ? "Новая бригада" : draft.name || "Бригада"}
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="ml-auto h-9 px-3 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)] press-scale disabled:opacity-40"
        >
          {isNew ? "Создать" : "Сохранить"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+100px)] space-y-4">
          {/* ── Section: Инфо ──────────────────────────────────────── */}
          <Section title="Информация">
            <FieldRow label="Название">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Напр. Юра + Даня"
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </FieldRow>
            <FieldRow label="Регион (описание)">
              <input
                type="text"
                value={draft.region}
                onChange={(e) => update("region", e.target.value)}
                placeholder="Напр. Пафос, Лимассол"
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </FieldRow>
            <FieldRow label="Цвет бригады">
              <div className="flex flex-wrap gap-2.5">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update("color", c.value)}
                    aria-label={c.name}
                    className={`w-9 h-9 rounded-full press-scale transition ${
                      draft.color === c.value ? "ring-[3px] ring-offset-2 ring-[var(--accent)]" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </FieldRow>
            <FieldRow label="Статус">
              <button
                type="button"
                onClick={() => update("active", !draft.active)}
                className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[14px] font-medium press-scale ${
                  draft.active
                    ? "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                }`}
              >
                {draft.active ? <Check size={14} /> : <X size={14} />}
                {draft.active ? "Активна" : "В архиве"}
              </button>
            </FieldRow>
          </Section>

          {/* ── Section: Города (филиалы) ──────────────────────────── */}
          <Section
            title="Города / Филиалы"
            subtitle="Где бригада работает. Первый выбранный — базовый город (дефолт для новых дней)."
          >
            <div className="flex flex-wrap gap-2">
              {activeCities.map((c) => {
                const selected = (draft.cities ?? []).includes(c.name) || draft.default_city === c.name;
                const isBase = draft.default_city === c.name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCity(c.name)}
                    onDoubleClick={() => update("default_city", c.name)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[14px] font-medium press-scale transition ${
                      isBase
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : selected
                          ? "bg-[var(--accent-tint)] text-[var(--accent)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                    }`}
                  >
                    {isBase && <Check size={14} />}
                    {c.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[12px] text-[var(--label-tertiary)]">
              Тап — добавить/убрать. Двойной тап — сделать базовым (синий).
            </div>
            <FieldRow label="Базовый город">
              <select
                value={draft.default_city}
                onChange={(e) => update("default_city", e.target.value)}
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">— не выбран —</option>
                {activeCities.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </FieldRow>
          </Section>

          {/* ── Section: Мастера ───────────────────────────────────── */}
          <Section
            title="Мастера"
            subtitle="Бригадир отвечает за бригаду. Помощники работают под его началом."
          >
            <FieldRow label="Бригадир (лид)">
              <select
                value={leadId ?? ""}
                onChange={(e) => setLeadId(e.target.value || null)}
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">— не назначен —</option>
                {availableLeads.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Помощники">
              {availableHelpers.length === 0 ? (
                <div className="text-[13px] text-[var(--label-tertiary)] py-2">
                  Нет свободных мастеров. Создайте их в разделе Мастера.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--separator)] -my-2">
                  {availableHelpers.map((m) => {
                    const checked = helperIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 py-3 cursor-pointer active:bg-[var(--fill-quaternary)] transition"
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center press-scale ${
                            checked ? "bg-[var(--accent)]" : "border-2 border-[var(--separator-opaque)]"
                          }`}
                        >
                          {checked && <Check size={14} className="text-[var(--label-on-accent)]" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 text-[15px] text-[var(--label)]">{m.full_name}</div>
                        <input type="checkbox" checked={checked} onChange={() => toggleHelper(m.id)} className="sr-only" />
                      </label>
                    );
                  })}
                </div>
              )}
            </FieldRow>
          </Section>

          {/* ── Section: Услуги ────────────────────────────────────── */}
          <Section
            title="Услуги бригады"
            subtitle="Какие услуги эта бригада делает. Если не выбрано ничего — бригаде доступны все услуги."
          >
            {services.length === 0 ? (
              <div className="text-[13px] text-[var(--label-tertiary)] py-2">
                Нет услуг. Создайте их в разделе Услуги.
              </div>
            ) : (
              serviceCategories.map((cat) => {
                const catServices = services.filter((s) => s.category_id === cat.id);
                if (catServices.length === 0) return null;
                return (
                  <div key={cat.id} className="mt-3 first:mt-0">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                      {cat.name}
                    </div>
                    <div className="flex flex-col divide-y divide-[var(--separator)]">
                      {catServices.map((s) => {
                        const checked = serviceHasThisBrigade(s);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-3 py-3 cursor-pointer"
                          >
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center press-scale ${
                                checked ? "bg-[var(--accent)]" : "border-2 border-[var(--separator-opaque)]"
                              }`}
                            >
                              {checked && <Check size={14} className="text-[var(--label-on-accent)]" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] text-[var(--label)] truncate">{s.name}</div>
                              <div className="text-[12px] text-[var(--label-secondary)]">
                                {s.duration_minutes} мин · €{s.price}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleService(s)}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </Section>

          {/* ── Section: Календарь бригады ─────────────────────────── */}
          <Section
            title="Календарь бригады"
            subtitle="Окно и стартовая точка календаря, когда выбрана эта бригада. Всё необязательно — пусто = как в общих настройках."
          >
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Начало сетки">
                <input
                  type="time"
                  value={draft.calendar_window_start ?? ""}
                  onChange={(e) => update("calendar_window_start", e.target.value)}
                  step={1800}
                  className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </FieldRow>
              <FieldRow label="Конец сетки">
                <input
                  type="time"
                  value={draft.calendar_window_end ?? ""}
                  onChange={(e) => update("calendar_window_end", e.target.value)}
                  step={1800}
                  className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </FieldRow>
            </div>
            <FieldRow label="Стартовый скролл при открытии">
              <input
                type="time"
                value={draft.default_scroll_time ?? ""}
                onChange={(e) => update("default_scroll_time", e.target.value)}
                step={1800}
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </FieldRow>
            <div className="text-[12px] text-[var(--label-tertiary)]">
              Примеры: сетка 06:00–23:30, скролл 14:00. Рабочие часы бригады
              (подсветка) настраиваются в разделе «Расписание».
            </div>
          </Section>

          {/* ── Section: Расписание (shortcut) ─────────────────────── */}
          <Section title="Расписание работы">
            <button
              type="button"
              onClick={() => router.push("/dashboard/schedule")}
              className="w-full h-12 flex items-center justify-between px-4 rounded-[10px] bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)] press-scale"
            >
              <div className="text-left">
                <div className="text-[15px] font-medium text-[var(--label)]">
                  Часы работы по дням недели
                </div>
                <div className="text-[12px] text-[var(--label-secondary)]">
                  Базовое расписание + перерывы
                </div>
              </div>
              <ChevronLeft size={18} strokeWidth={2.5} className="rotate-180 text-[var(--label-tertiary)]" />
            </button>
          </Section>

          {/* ── Section: ЗП и доступы ──────────────────────────────── */}
          <Section title="ЗП и доступы">
            <FieldRow label="Зарплата (% от чистого дохода бригады)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.payout_percentage}
                  onChange={(e) => update("payout_percentage", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="w-20 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <span className="text-[15px] text-[var(--label-secondary)]">%</span>
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
                Применяется к (доход – расход бригады) за выбранный период.
                Используется на странице Финансы → Зарплата.
              </div>
            </FieldRow>
          </Section>

          {/* ── Delete (bottom) ────────────────────────────────────── */}
          {!isNew && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-[10px] bg-[var(--surface-card)] text-[var(--system-red)] text-[15px] font-medium press-scale active:bg-[rgba(255,59,48,0.08)]"
              >
                <Trash2 size={16} strokeWidth={2} />
                Удалить бригаду
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout primitives ─────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
