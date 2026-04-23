"use client";

// Sprint 033 Phase I28 — Schedule, full pass.
//
// Added everything the user asked for in one go:
//  · Multiple breaks in the base schedule (add / remove rows).
//  · Per-weekday overrides — tap a weekday chip, set its own time
//    range and its own breaks; tap the chip again to revert to
//    general.
//  · Vacations — list of date ranges that make the brigade
//    unavailable on every day inside them.
//  · Presets — three quick templates (09–18 будни, 08–22 без
//    выходных, 10–19 с обедом) to stamp the base schedule in one
//    tap.
//
// Everything still instant-save via setSchedules. No Save button.

import { use, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useSchedules, useTeams } from "@/app/dashboard/layout";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  type DaySchedule,
  type ScheduleBreak,
  type TeamSchedule,
  type VacationRange,
  type WeekdayKey,
} from "@/lib/schedule";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const PRESETS: Array<{
  label: string;
  subtitle: string;
  schedule: TeamSchedule;
}> = [
  {
    label: "9–18 · будни",
    subtitle: "Сб / Вс выходной",
    schedule: {
      start: "09:00",
      end: "18:00",
      breaks: [],
      overrides: {
        sat: { is_working: false, start: "00:00", end: "00:00", breaks: [] },
        sun: { is_working: false, start: "00:00", end: "00:00", breaks: [] },
      },
    },
  },
  {
    label: "8–22 · без выходных",
    subtitle: "Длинный день, работает всегда",
    schedule: {
      start: "08:00",
      end: "22:00",
      breaks: [],
      overrides: {},
    },
  },
  {
    label: "10–19 · с обедом",
    subtitle: "Перерыв 13:00–14:00",
    schedule: {
      start: "10:00",
      end: "19:00",
      breaks: [{ start: "13:00", end: "14:00" }],
      overrides: {},
    },
  },
];

export default function BrigadeSchedulePage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams } = useTeams();
  const { schedules, setSchedules } = useSchedules();
  const team = teams.find((t) => t.id === id);

  const schedule: TeamSchedule = schedules[id] ?? DEFAULT_SCHEDULE;
  const breaks = schedule.breaks ?? [];
  const vacations = schedule.vacations ?? [];

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const persist = (next: TeamSchedule) => {
    setSchedules({ ...schedules, [id]: next });
  };

  // ── General time ───────────────────────────────────────────────
  const updateBase = (key: "start" | "end", value: string) => {
    persist({ ...schedule, [key]: value });
  };

  // ── Breaks ─────────────────────────────────────────────────────
  const addBreak = () => {
    haptic("tap");
    const fallback: ScheduleBreak = { start: "13:00", end: "14:00" };
    persist({ ...schedule, breaks: [...breaks, fallback] });
  };
  const updateBreak = (idx: number, patch: Partial<ScheduleBreak>) => {
    persist({
      ...schedule,
      breaks: breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };
  const removeBreak = (idx: number) => {
    haptic("warning");
    persist({ ...schedule, breaks: breaks.filter((_, i) => i !== idx) });
  };

  // ── Per-weekday overrides ──────────────────────────────────────
  const dayOverride = (k: WeekdayKey): DaySchedule | undefined =>
    schedule.overrides?.[k];

  const ensureOverride = (k: WeekdayKey): DaySchedule =>
    dayOverride(k) ?? {
      is_working: true,
      start: schedule.start,
      end: schedule.end,
      breaks: [],
    };

  const setDayOverride = (k: WeekdayKey, next: DaySchedule | null) => {
    const overrides = { ...(schedule.overrides ?? {}) };
    if (next === null) delete overrides[k];
    else overrides[k] = next;
    persist({ ...schedule, overrides });
  };

  const toggleDayOff = (k: WeekdayKey) => {
    haptic("tap");
    const cur = dayOverride(k);
    if (cur && !cur.is_working) {
      setDayOverride(k, null); // was day-off → revert to general
    } else {
      setDayOverride(k, {
        is_working: false,
        start: schedule.start,
        end: schedule.end,
        breaks: [],
      });
    }
  };

  // ── Vacations ──────────────────────────────────────────────────
  const addVacation = () => {
    haptic("tap");
    // Default to today → +7 days so the user just adjusts.
    const today = new Date();
    const end = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    persist({
      ...schedule,
      vacations: [
        ...vacations,
        { start: fmt(today), end: fmt(end), reason: "" },
      ],
    });
  };
  const updateVacation = (idx: number, patch: Partial<VacationRange>) => {
    persist({
      ...schedule,
      vacations: vacations.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    });
  };
  const removeVacation = (idx: number) => {
    haptic("warning");
    persist({
      ...schedule,
      vacations: vacations.filter((_, i) => i !== idx),
    });
  };

  // ── Presets ────────────────────────────────────────────────────
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    haptic("tap");
    persist({
      ...schedule,
      start: p.schedule.start,
      end: p.schedule.end,
      breaks: p.schedule.breaks,
      overrides: p.schedule.overrides,
    });
  };

  // Subtitle for each weekday chip in the override list.
  const daySubtitle = (k: WeekdayKey): string => {
    const ov = dayOverride(k);
    if (!ov) return "как обычно";
    if (!ov.is_working) return "выходной";
    return `${ov.start}–${ov.end}${
      ov.breaks.length > 0 ? ` · перерыв` : ""
    }`;
  };

  // Days that currently have a custom override so we can show edit
  // blocks for them below the weekday strip.
  const overriddenDays = useMemo<WeekdayKey[]>(
    () =>
      WEEKDAY_KEYS.filter((k) => {
        const ov = dayOverride(k);
        return !!ov && ov.is_working; // day-offs render as the chip itself; only working-day overrides get the per-day editor
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule.overrides],
  );

  return (
    <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
      {/* ── Presets ─────────────────────────────────────── */}
      <Group title="Быстрые шаблоны">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-[var(--label)] truncate">
                  {p.label}
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] truncate">
                  {p.subtitle}
                </div>
              </div>
              <span className="text-[13px] text-[var(--accent)] font-medium">
                применить
              </span>
            </button>
          ))}
        </div>
      </Group>

      {/* ── Working hours (general) ─────────────────────── */}
      <Group title="Время работы">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <TimePair
              prefix="с"
              value={schedule.start ?? "09:00"}
              onChange={(v) => updateBase("start", v)}
            />
            <TimePair
              prefix="до"
              value={schedule.end ?? "18:00"}
              onChange={(v) => updateBase("end", v)}
            />
          </div>
        </div>
      </Group>

      {/* ── Breaks (multiple) ───────────────────────────── */}
      <Group
        title="Перерывы"
        footer="Обед, полдник и всё остальное — просто добавьте ряд для каждого."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          {breaks.length === 0 && (
            <div className="px-4 py-2.5 text-[13px] text-[var(--label-tertiary)]">
              Без перерывов.
            </div>
          )}
          {breaks.map((b, idx) => (
            <div
              key={idx}
              className={`px-3 py-3 ${idx > 0 ? "border-t border-[var(--separator)]" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <TimePair
                    prefix="с"
                    value={b.start}
                    onChange={(v) => updateBreak(idx, { start: v })}
                  />
                  <TimePair
                    prefix="до"
                    value={b.end}
                    onChange={(v) => updateBreak(idx, { end: v })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeBreak(idx)}
                  aria-label="Удалить"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addBreak}
            className="w-full h-10 border-t border-[var(--separator)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
          >
            <Plus size={14} strokeWidth={2.5} />
            Добавить перерыв
          </button>
        </div>
      </Group>

      {/* ── Per-weekday ─────────────────────────────────── */}
      <Group
        title="Дни недели"
        footer="Тап по дню — сделать выходным. Для особого времени в конкретный день — откройте блок ниже."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_KEYS.map((k) => {
              const ov = dayOverride(k);
              const off = !!ov && !ov.is_working;
              const customWorking = !!ov && ov.is_working;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleDayOff(k)}
                  className={`h-10 rounded-[10px] text-[13px] font-semibold press-scale transition ${
                    off
                      ? "bg-[var(--system-red)] text-white"
                      : customWorking
                        ? "bg-[var(--accent-tint)] text-[var(--accent)]"
                        : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                  }`}
                >
                  {WEEKDAY_NAMES[k]}
                </button>
              );
            })}
          </div>
          {/* Quick-add per-day custom time */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {WEEKDAY_KEYS.map((k) => {
              const ov = dayOverride(k);
              const customWorking = !!ov && ov.is_working;
              if (customWorking) return null;
              if (ov && !ov.is_working) return null;
              return (
                <button
                  key={`add-${k}`}
                  type="button"
                  onClick={() =>
                    setDayOverride(k, ensureOverride(k))
                  }
                  className="h-8 px-2.5 rounded-full text-[12px] font-medium press-scale bg-[var(--fill-tertiary)] text-[var(--label)] flex items-center gap-1"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  {WEEKDAY_NAMES[k]} — своё время
                </button>
              );
            })}
          </div>
        </div>
      </Group>

      {/* ── Day override editors ────────────────────────── */}
      {overriddenDays.map((k) => {
        const ov = ensureOverride(k);
        return (
          <Group
            key={`override-${k}`}
            title={`Особое время · ${WEEKDAY_NAMES[k].toUpperCase()}`}
          >
            <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 min-h-[52px]">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[var(--label)]">
                    Использовать своё время
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] leading-snug">
                    {daySubtitle(k)}
                  </div>
                </div>
                <IOSSwitch
                  checked
                  onChange={() => setDayOverride(k, null)}
                  ariaLabel="Сбросить к общему"
                />
              </div>
              <div className="border-t border-[var(--separator)] px-3 py-3 grid grid-cols-2 gap-2">
                <TimePair
                  prefix="с"
                  value={ov.start}
                  onChange={(v) =>
                    setDayOverride(k, { ...ov, start: v })
                  }
                />
                <TimePair
                  prefix="до"
                  value={ov.end}
                  onChange={(v) =>
                    setDayOverride(k, { ...ov, end: v })
                  }
                />
              </div>
              <PerDayBreaks
                breaks={ov.breaks}
                onChange={(bb) => setDayOverride(k, { ...ov, breaks: bb })}
              />
            </div>
          </Group>
        );
      })}

      {/* ── Vacations ───────────────────────────────────── */}
      <Group
        title="Отпуска"
        footer="Бригада недоступна в календаре в эти дни. Праздники, отпуска, болезни — всё сюда."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          {vacations.length === 0 && (
            <div className="px-4 py-2.5 text-[13px] text-[var(--label-tertiary)]">
              Пока пусто.
            </div>
          )}
          {vacations.map((v, idx) => (
            <div
              key={idx}
              className={`px-3 py-3 ${idx > 0 ? "border-t border-[var(--separator)]" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <DatePair
                    prefix="с"
                    value={v.start}
                    onChange={(val) => updateVacation(idx, { start: val })}
                  />
                  <DatePair
                    prefix="до"
                    value={v.end}
                    onChange={(val) => updateVacation(idx, { end: val })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVacation(idx)}
                  aria-label="Удалить отпуск"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
              <input
                type="text"
                value={v.reason ?? ""}
                onChange={(e) => updateVacation(idx, { reason: e.target.value })}
                placeholder="Причина (необязательно)"
                maxLength={60}
                className="mt-2 w-full h-9 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addVacation}
            className="w-full h-10 border-t border-[var(--separator)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
          >
            <Plus size={14} strokeWidth={2.5} />
            Добавить отпуск
          </button>
        </div>
      </Group>
    </BrigadeSectionShell>
  );
}

// ─── Shared building blocks ────────────────────────────────────

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      {children}
      {footer && (
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

function TimePair({
  prefix,
  value,
  onChange,
}: {
  prefix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[var(--label-tertiary)] w-6 text-right shrink-0">
        {prefix}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={1800}
        className="flex-1 min-w-0 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}

function DatePair({
  prefix,
  value,
  onChange,
}: {
  prefix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[var(--label-tertiary)] w-6 text-right shrink-0">
        {prefix}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}

// Small nested breaks list for a per-day override block.
function PerDayBreaks({
  breaks,
  onChange,
}: {
  breaks: ScheduleBreak[];
  onChange: (next: ScheduleBreak[]) => void;
}) {
  const add = () =>
    onChange([...breaks, { start: "13:00", end: "14:00" }]);
  const update = (idx: number, patch: Partial<ScheduleBreak>) =>
    onChange(breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const remove = (idx: number) =>
    onChange(breaks.filter((_, i) => i !== idx));

  if (breaks.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        className="w-full h-10 border-t border-[var(--separator)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
      >
        <Plus size={14} strokeWidth={2.5} />
        Добавить перерыв
      </button>
    );
  }

  return (
    <div>
      {breaks.map((b, idx) => (
        <div
          key={idx}
          className="border-t border-[var(--separator)] px-3 py-3 flex items-center gap-2"
        >
          <div className="grid grid-cols-2 gap-2 flex-1">
            <TimePair
              prefix="с"
              value={b.start}
              onChange={(v) => update(idx, { start: v })}
            />
            <TimePair
              prefix="до"
              value={b.end}
              onChange={(v) => update(idx, { end: v })}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            aria-label="Удалить"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full h-10 border-t border-[var(--separator)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
      >
        <Plus size={14} strokeWidth={2.5} />
        Ещё перерыв
      </button>
    </div>
  );
}
