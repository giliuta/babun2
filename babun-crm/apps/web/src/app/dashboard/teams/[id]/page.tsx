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
import { ChevronLeft, Trash2, Check, X, Plus } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useMasters, useTeams, useServices, useAppointments, useCities, useSchedules } from "@/app/dashboard/layout";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  type ScheduleBreak,
  type TeamSchedule,
  type WeekdayKey,
} from "@/lib/schedule";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  TEAM_COLORS,
  generateId,
  getTeamLeadIds,
  type Master,
  type Team,
} from "@/lib/masters";
import { createBlankService, type Service } from "@/lib/services";
import { CITY_COLOR_PRESETS, generateCityId, type City } from "@/lib/cities";

const BLANK_TEAM: Team = {
  id: "",
  name: "",
  region: "",
  color: TEAM_COLORS[0].value,
  default_city: "",
  lead_id: null,
  lead_ids: [],
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
  const { cities, setCities } = useCities();
  const { schedules, setSchedules } = useSchedules();

  const schedule: TeamSchedule = schedules[id] ?? DEFAULT_SCHEDULE;

  // Break state derived from the first item in schedule.breaks — one
  // break per day is enough for the Bumpix-style inline editor; the
  // full /dashboard/schedule page still supports arbitrarily many.
  const firstBreak: ScheduleBreak | null = schedule.breaks?.[0] ?? null;

  const persistSchedule = (next: TeamSchedule) => {
    setSchedules({ ...schedules, [id]: next });
  };

  const updateScheduleBase = (key: "start" | "end", value: string) => {
    persistSchedule({ ...schedule, [key]: value });
  };

  const toggleBreak = (on: boolean) => {
    if (on) {
      persistSchedule({ ...schedule, breaks: [{ start: "13:00", end: "14:00" }] });
    } else {
      persistSchedule({ ...schedule, breaks: [] });
    }
  };

  const updateBreak = (key: "start" | "end", value: string) => {
    const current = schedule.breaks?.[0] ?? { start: "13:00", end: "14:00" };
    const nextBreak: ScheduleBreak = { ...current, [key]: value };
    persistSchedule({ ...schedule, breaks: [nextBreak] });
  };

  // Weekday overrides used for "выходные дни". Tapping a chip flips
  // `is_working` on that weekday's override, leaving everything else
  // about the day's schedule in sync with the base.
  const isDayOff = (key: WeekdayKey): boolean => {
    const ov = schedule.overrides?.[key];
    return ov ? !ov.is_working : false;
  };

  const toggleDayOff = (key: WeekdayKey) => {
    haptic("tap");
    const overrides = { ...(schedule.overrides ?? {}) };
    if (isDayOff(key)) {
      // Was off → clear override (fall back to base = working).
      delete overrides[key];
    } else {
      overrides[key] = {
        is_working: false,
        start: schedule.start,
        end: schedule.end,
        breaks: [],
      };
    }
    persistSchedule({ ...schedule, overrides });
  };

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
  const [leadIds, setLeadIds] = useState<string[]>(getTeamLeadIds(originalTeam));
  const [helperIds, setHelperIds] = useState<string[]>(originalTeam.helper_ids);

  // Inline add-city form state. The brigade editor is intentionally
  // the only place custom tags can be created ("Германия", "День ног")
  // so the user never has to leave the page.
  const [newCityName, setNewCityName] = useState("");
  const [newCityColor, setNewCityColor] = useState(CITY_COLOR_PRESETS[0].value);
  const [addingCity, setAddingCity] = useState(false);

  // Inline add-service form state.
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceMinutes, setNewServiceMinutes] = useState(60);
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [addingService, setAddingService] = useState(false);

  // If teams list arrives after mount (async hydrate in some cases),
  // rehydrate the draft from the stored team so the form isn't stuck
  // on the blank snapshot.
  useEffect(() => {
    if (!isNew && originalTeam.id && draft.id === "") {
      setDraft(originalTeam);
      setLeadIds(getTeamLeadIds(originalTeam));
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
      const next = current.filter((c) => c !== cityName);
      update("cities", next);
      // If we just removed the current default_city, clear it.
      if (draft.default_city === cityName) update("default_city", "");
    } else {
      const next = [...current, cityName];
      update("cities", next);
      // First city becomes default automatically — matches the
      // "Базовый город появляется после добавления" UX.
      if (!draft.default_city) update("default_city", cityName);
    }
  };

  const addNewCity = () => {
    const name = newCityName.trim();
    if (!name) return;
    if (cities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      // Already exists — just toggle it onto this brigade.
      toggleCity(name);
      setNewCityName("");
      setAddingCity(false);
      return;
    }
    haptic("tap");
    const created: City = {
      id: generateCityId(),
      name,
      country: "",
      isActive: true,
      color: newCityColor,
    };
    setCities([...cities, created]);
    // Auto-add to brigade list + make it default if none yet.
    const brigadeCities = draft.cities ?? [];
    update("cities", [...brigadeCities, name]);
    if (!draft.default_city) update("default_city", name);
    setNewCityName("");
    setNewCityColor(CITY_COLOR_PRESETS[0].value);
    setAddingCity(false);
  };

  const addNewService = () => {
    const name = newServiceName.trim();
    if (!name || !draft.id) return;
    haptic("tap");
    const created = createBlankService({
      name,
      duration_minutes: Math.max(1, newServiceMinutes),
      price: Math.max(0, newServicePrice),
      brigade_ids: [draft.id],
    });
    upsertService(created);
    setNewServiceName("");
    setNewServiceMinutes(60);
    setNewServicePrice(0);
    setAddingService(false);
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
      // A helper tick also un-ticks the lead (a master can be one or
      // the other, not both). Keeps save-logic simple.
      setHelperIds([...helperIds, masterId]);
      setLeadIds(leadIds.filter((id) => id !== masterId));
    }
  };

  const toggleLead = (masterId: string) => {
    haptic("tap");
    if (leadIds.includes(masterId)) {
      setLeadIds(leadIds.filter((id) => id !== masterId));
    } else {
      setLeadIds([...leadIds, masterId]);
      // Ticking as lead un-ticks helper for the same person.
      setHelperIds(helperIds.filter((id) => id !== masterId));
    }
  };

  const availableMasters = masters.filter(
    (m) => m.team_id === null || m.team_id === draft.id || leadIds.includes(m.id) || helperIds.includes(m.id),
  );

  const handleSave = () => {
    if (!draft.name.trim()) {
      haptic("warning");
      return;
    }
    haptic("tap");

    const dedupedLeads = Array.from(new Set(leadIds));
    // Helpers cannot also be leads — de-dupe.
    const dedupedHelpers = helperIds.filter((id) => !dedupedLeads.includes(id));

    const saved: Team = {
      ...draft,
      lead_id: dedupedLeads[0] ?? null, // legacy compat
      lead_ids: dedupedLeads.length > 0 ? dedupedLeads : undefined,
      helper_ids: dedupedHelpers,
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
    dedupedLeads.forEach((mid) => memberIds.add(mid));
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
            <FieldRow label="Описание">
              <textarea
                value={draft.region}
                onChange={(e) => update("region", e.target.value)}
                placeholder="Комментарий к бригаде — для вас"
                rows={2}
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
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

          {/* ── Section: Города (филиалы / теги) ───────────────────── */}
          <Section
            title="Города / Филиалы"
            subtitle="Где бригада работает. Добавляйте любые теги — Германия, День ног — они сразу появятся в календаре в своём цвете."
          >
            <div className="flex flex-wrap gap-2">
              {activeCities.map((c) => {
                const selected = (draft.cities ?? []).includes(c.name) || draft.default_city === c.name;
                const isBase = draft.default_city === c.name;
                const tint = c.color ?? "var(--accent)";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCity(c.name)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[14px] font-medium press-scale transition ${
                      isBase
                        ? "text-[var(--label-on-accent)]"
                        : selected
                          ? "text-[var(--label)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                    }`}
                    style={
                      isBase
                        ? { backgroundColor: tint }
                        : selected
                          ? { backgroundColor: `${tint}22`, color: tint }
                          : undefined
                    }
                  >
                    {c.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />}
                    {c.name}
                    {isBase && <Check size={14} strokeWidth={2.5} />}
                  </button>
                );
              })}

              {/* Inline add-city button */}
              {!addingCity && (
                <button
                  type="button"
                  onClick={() => setAddingCity(true)}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-[14px] font-medium bg-[var(--accent-tint)] text-[var(--accent)] press-scale"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Добавить
                </button>
              )}
            </div>

            {/* Inline add-city form */}
            {addingCity && (
              <div className="bg-[var(--fill-tertiary)] rounded-[10px] p-3 space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNewCity();
                    if (e.key === "Escape") setAddingCity(false);
                  }}
                  placeholder="Название (напр. Германия, День ног)"
                  className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <div>
                  <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
                    Цвет
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CITY_COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewCityColor(c.value)}
                        aria-label={c.name}
                        className={`w-8 h-8 rounded-full press-scale ${
                          newCityColor === c.value ? "ring-[3px] ring-offset-2 ring-[var(--accent)]" : ""
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAddingCity(false); setNewCityName(""); }}
                    className="flex-1 h-10 rounded-[10px] bg-[var(--fill-secondary)] text-[14px] font-medium text-[var(--label)] press-scale"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={addNewCity}
                    disabled={!newCityName.trim()}
                    className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {/* Базовый город — shows only after at least one city is picked */}
            {(draft.cities?.length ?? 0) > 0 && (
              <FieldRow label="Базовый город">
                <select
                  value={draft.default_city}
                  onChange={(e) => update("default_city", e.target.value)}
                  className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">— не выбран —</option>
                  {(draft.cities ?? []).map((cityName) => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
                <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
                  Ставится дефолтом на каждый день. Тап по дню в календаре переопределяет.
                </div>
              </FieldRow>
            )}
          </Section>

          {/* ── Section: Мастера ───────────────────────────────────── */}
          <Section
            title="Мастера"
            subtitle="Бригадиров и помощников может быть несколько. Отметь галочкой — мастер закрепится за бригадой и увидит её в календаре."
          >
            {availableMasters.length === 0 ? (
              <div className="text-[13px] text-[var(--label-tertiary)] py-2">
                Нет свободных мастеров. Создайте их в разделе Мастера.
              </div>
            ) : (
              <>
                <FieldRow label="Бригадиры">
                  <div className="flex flex-col divide-y divide-[var(--separator)] -my-2">
                    {availableMasters.map((m) => {
                      const checked = leadIds.includes(m.id);
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
                          <input type="checkbox" checked={checked} onChange={() => toggleLead(m.id)} className="sr-only" />
                        </label>
                      );
                    })}
                  </div>
                </FieldRow>

                <FieldRow label="Помощники">
                  <div className="flex flex-col divide-y divide-[var(--separator)] -my-2">
                    {availableMasters.map((m) => {
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
                </FieldRow>
              </>
            )}
          </Section>

          {/* ── Section: Услуги ────────────────────────────────────── */}
          <Section
            title="Услуги бригады"
            subtitle="Какие услуги делает бригада. При записи клиента показываются только они. Не выбрано ничего — доступны все услуги."
          >
            {/* Inline add-service form */}
            {addingService ? (
              <div className="bg-[var(--fill-tertiary)] rounded-[10px] p-3 space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNewService();
                    if (e.key === "Escape") setAddingService(false);
                  }}
                  placeholder="Название услуги"
                  className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1">
                      Длительность
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        step={5}
                        value={newServiceMinutes}
                        onChange={(e) => setNewServiceMinutes(Number(e.target.value) || 0)}
                        className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <span className="text-[14px] text-[var(--label-secondary)]">мин</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1">
                      Цена
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] text-[var(--label-secondary)]">€</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(Number(e.target.value) || 0)}
                        className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAddingService(false); setNewServiceName(""); }}
                    className="flex-1 h-10 rounded-[10px] bg-[var(--fill-secondary)] text-[14px] font-medium text-[var(--label)] press-scale"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={addNewService}
                    disabled={!newServiceName.trim()}
                    className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40"
                  >
                    Добавить услугу
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAddingService(true); if (!isNew) return; }}
                disabled={isNew}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] text-[14px] font-semibold press-scale disabled:opacity-40"
              >
                <Plus size={16} strokeWidth={2.5} />
                {isNew ? "Сохраните бригаду, чтобы добавлять услуги" : "Добавить новую услугу"}
              </button>
            )}

            {services.length === 0 ? (
              <div className="text-[13px] text-[var(--label-tertiary)] py-2">
                Пока нет услуг. Добавьте первую выше.
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

          {/* ── Section: Настройки календаря ───────────────────────── */}
          <Section
            title="Настройки календаря"
            subtitle="Как выглядит календарь, когда выбрана эта бригада."
          >
            {/* Grid window */}
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
                Сетка календаря
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
                  <input
                    type="time"
                    value={draft.calendar_window_start ?? ""}
                    onChange={(e) => update("calendar_window_start", e.target.value)}
                    step={1800}
                    className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--label-tertiary)]">по</span>
                  <input
                    type="time"
                    value={draft.calendar_window_end ?? ""}
                    onChange={(e) => update("calendar_window_end", e.target.value)}
                    step={1800}
                    className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
                Сколько часов видно в календаре. Пусто = 00:00–24:00.
              </div>
            </div>

            <FieldRow label="Открывать на">
              <input
                type="time"
                value={draft.default_scroll_time ?? ""}
                onChange={(e) => update("default_scroll_time", e.target.value)}
                step={1800}
                className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="text-[12px] text-[var(--label-tertiary)] mt-1">
                При открытии бригады календарь проскроллится сюда. Пусто = как обычно.
              </div>
            </FieldRow>
          </Section>

          {/* ── Section: Расписание дня бригады (Bumpix-style) ─────── */}
          <Section
            title="Расписание дня бригады"
            subtitle="График работы. В эти часы колонки календаря подсвечиваются светлее."
          >
            {/* Work hours */}
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
                Время работы
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
                  <input
                    type="time"
                    value={schedule.start ?? "09:00"}
                    onChange={(e) => updateScheduleBase("start", e.target.value)}
                    step={1800}
                    className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--label-tertiary)]">до</span>
                  <input
                    type="time"
                    value={schedule.end ?? "18:00"}
                    onChange={(e) => updateScheduleBase("end", e.target.value)}
                    step={1800}
                    className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            {/* Break */}
            <div>
              <div className="flex items-center justify-between py-1">
                <div className="text-[15px] font-medium text-[var(--label)]">Перерыв</div>
                <IOSSwitch
                  checked={firstBreak !== null}
                  onChange={toggleBreak}
                  ariaLabel="Включить перерыв"
                />
              </div>
              {firstBreak ? (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
                    <input
                      type="time"
                      value={firstBreak.start}
                      onChange={(e) => updateBreak("start", e.target.value)}
                      step={1800}
                      className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-[var(--label-tertiary)]">до</span>
                    <input
                      type="time"
                      value={firstBreak.end}
                      onChange={(e) => updateBreak("end", e.target.value)}
                      step={1800}
                      className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-[var(--label-tertiary)]">
                  Без перерыва
                </div>
              )}
            </div>

            {/* Day-off chips — weekdays the brigade doesn't work */}
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
                Выходные дни
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_KEYS.map((k) => {
                  const off = isDayOff(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleDayOff(k)}
                      className={`inline-flex items-center justify-center h-9 min-w-[44px] px-3 rounded-full text-[14px] font-medium press-scale transition ${
                        off
                          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                      }`}
                    >
                      {WEEKDAY_NAMES[k]}
                    </button>
                  );
                })}
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
                Отмеченные дни бригада не работает. Тап — включить/выключить.
              </div>
            </div>
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
