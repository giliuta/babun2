"use client";

// Sprint 033 Phase I34 — Schedule redesign.
//
// Dropped «Быстрые шаблоны» (никогда не пригождалось) и переделал
// «Дни недели» в iOS-grouped-list с одной строкой на день:
//   · Слева — Пн/Вт/…/Вс
//   · По центру — состояние: «09:00–18:00» или «выходной»
//     (синим, если у дня СВОЁ время)
//   · Справа — тумблер «выходной»
//   · Тап по строке (если день рабочий) — раскрывает inline-
//     редактор: своё время начала/конца, свои перерывы, кнопка
//     «сбросить к общему».
//
// Отдельных «Особое время · СР» блоков больше нет — всё внутри
// своей же строки. Пустое поле — значит день работает по общему
// времени выше.

import { use, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useSchedules, useTeams } from "@/components/layout/DashboardClientLayout";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  type DaySchedule,
  type ScheduleBreak,
  type TeamSchedule,
  type VacationRange,
  type WeekdayKey,
} from "@babun/shared/local/schedule";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeSchedulePage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams } = useTeams();
  const { schedules, setSchedules } = useSchedules();
  const team = teams.find((t) => t.id === id);

  const schedule: TeamSchedule = schedules[id] ?? DEFAULT_SCHEDULE;
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

  // Per-day expansion state for the inline editor.
  const [expandedDay, setExpandedDay] = useState<WeekdayKey | null>(null);

  // Read-only summary of off days for the general header
  const offDaysList = WEEKDAY_KEYS.filter((k) => {
    const ov = dayOverride(k);
    return !!ov && !ov.is_working;
  })
    .map((k) => WEEKDAY_NAMES[k])
    .join(", ");

  return (
    <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
      {/* ── Working hours (general) ─────────────────────── */}
      <Group title="Время работы">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-3 py-3">
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
          <div className="border-t border-[var(--separator)] px-4 py-2.5 flex items-center gap-2">
            <span className="text-[13px] text-[var(--label-secondary)]">
              Выходные:
            </span>
            <span
              className={`text-[13px] ${
                offDaysList
                  ? "text-[var(--label)] font-medium"
                  : "text-[var(--label-tertiary)]"
              }`}
            >
              {offDaysList || "нет"}
            </span>
          </div>
        </div>
      </Group>

      {/* ── Per-weekday list ────────────────────────────── */}
      <Group
        title="Дни недели"
        footer="Тумблер справа — сделать день выходным. Под строкой — перерывы этого дня (обед, полдник и т.п.). Тап по времени — задать своё время для дня."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {WEEKDAY_KEYS.map((k) => {
            const ov = dayOverride(k);
            const isOff = !!ov && !ov.is_working;
            const isCustom = !!ov && ov.is_working;
            const dayStart = isCustom ? ov.start : schedule.start;
            const dayEnd = isCustom ? ov.end : schedule.end;
            const dayBreaks = isCustom ? ov.breaks : [];
            const expanded = expandedDay === k;

            const writeDay = (patch: Partial<DaySchedule>) => {
              const base = ensureOverride(k);
              setDayOverride(k, { ...base, is_working: true, ...patch });
            };

            return (
              <div key={k}>
                {/* Main row: day name · time state · «своё» chip · chevron · toggle */}
                <div className="flex items-center gap-3 px-4 min-h-[52px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (isOff) return;
                      setExpandedDay(expanded ? null : k);
                    }}
                    disabled={isOff}
                    className="flex items-center gap-3 flex-1 min-w-0 py-2 text-left active:opacity-70 disabled:active:opacity-100"
                  >
                    <span className="w-8 text-[15px] font-semibold text-[var(--label)] shrink-0">
                      {WEEKDAY_NAMES[k]}
                    </span>
                    <span
                      className={`flex-1 text-[13px] truncate ${
                        isOff
                          ? "text-[var(--label-tertiary)]"
                          : isCustom
                            ? "text-[var(--accent)] font-medium"
                            : "text-[var(--label-secondary)]"
                      }`}
                    >
                      {isOff ? "выходной" : `${dayStart}–${dayEnd}`}
                    </span>
                    {isCustom && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                        своё
                      </span>
                    )}
                    {!isOff && (
                      <ChevronDown
                        size={14}
                        strokeWidth={2}
                        className={`text-[var(--label-quaternary)] transition-transform shrink-0 ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>
                  <IOSSwitch
                    checked={!isOff}
                    onChange={(next) => {
                      haptic("tap");
                      if (next) {
                        setDayOverride(k, null);
                      } else {
                        setExpandedDay(null);
                        setDayOverride(k, {
                          is_working: false,
                          start: schedule.start,
                          end: schedule.end,
                          breaks: [],
                        });
                      }
                    }}
                    ariaLabel={`Рабочий день ${WEEKDAY_NAMES[k]}`}
                  />
                </div>

                {/* Per-day time editor — expands on tap */}
                {expanded && !isOff && (
                  <div className="bg-[var(--fill-tertiary)] border-t border-[var(--separator)] px-3 py-3 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--label-tertiary)] px-1">
                      Своё время на {WEEKDAY_NAMES[k]}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <TimePair
                        prefix="с"
                        value={dayStart}
                        onChange={(v) => writeDay({ start: v })}
                      />
                      <TimePair
                        prefix="до"
                        value={dayEnd}
                        onChange={(v) => writeDay({ end: v })}
                      />
                    </div>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic("tap");
                          setDayOverride(k, null);
                          setExpandedDay(null);
                        }}
                        className="w-full h-9 rounded-[10px] bg-[var(--surface-card)] text-[13px] text-[var(--accent)] font-medium press-scale"
                      >
                        Сбросить к общему
                      </button>
                    )}
                  </div>
                )}

                {/* Per-day breaks — ALWAYS visible under each working day */}
                {!isOff && (
                  <div className="border-t border-[var(--separator)] px-4 py-2">
                    <PerDayBreaks
                      breaks={dayBreaks}
                      onChange={(bb) => writeDay({ breaks: bb })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Group>

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
  compact,
}: {
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  /** Smaller pill for dense contexts (per-day breaks). */
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[var(--label-tertiary)] shrink-0 text-right ${
          compact ? "text-[11px] w-4" : "text-[12px] w-6"
        }`}
      >
        {prefix}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={1800}
        className={`flex-1 min-w-0 rounded-[8px] bg-[var(--fill-tertiary)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
          compact ? "h-8 px-2 text-[13px]" : "h-11 px-3 text-[15px]"
        }`}
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
        className="w-full h-8 rounded-[8px] bg-[var(--fill-tertiary)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[12px] font-medium press-scale"
      >
        <Plus size={12} strokeWidth={2.5} />
        Добавить перерыв
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      {breaks.map((b, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2"
        >
          <div className="grid grid-cols-2 gap-2 flex-1">
            <TimePair
              prefix="с"
              value={b.start}
              onChange={(v) => update(idx, { start: v })}
              compact
            />
            <TimePair
              prefix="до"
              value={b.end}
              onChange={(v) => update(idx, { end: v })}
              compact
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            aria-label="Удалить"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--fill-tertiary)] text-[var(--system-red)] press-scale"
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full h-8 rounded-[8px] bg-[var(--fill-tertiary)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[12px] font-medium press-scale"
      >
        <Plus size={12} strokeWidth={2.5} />
        Ещё перерыв
      </button>
    </div>
  );
}
