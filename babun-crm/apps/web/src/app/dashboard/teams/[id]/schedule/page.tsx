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
import { ChevronDown, Plus, Trash2 } from "lucide-react";
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

  return (
    <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
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

      {/* ── Per-weekday list ────────────────────────────── */}
      <Group
        title="Дни недели"
        footer="Тумблер справа — сделать день выходным. Тап на строку — раскрыть редактор своего времени и перерывов для этого дня."
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

            const stateText = isOff
              ? "выходной"
              : `${dayStart}–${dayEnd}${
                  isCustom && dayBreaks.length > 0
                    ? ` · перерыв${dayBreaks.length > 1 ? "ы" : ""}`
                    : ""
                }`;

            return (
              <div key={k}>
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
                      {stateText}
                    </span>
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
                        // Включаем день → сбрасываем override полностью,
                        // работает как общее время.
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

                {expanded && !isOff && (
                  <div className="bg-[var(--fill-tertiary)] border-t border-[var(--separator)] px-3 py-3 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--label-tertiary)] px-1">
                      Своё время на {WEEKDAY_NAMES[k]}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <TimePair
                        prefix="с"
                        value={dayStart}
                        onChange={(v) =>
                          setDayOverride(k, {
                            ...ensureOverride(k),
                            is_working: true,
                            start: v,
                          })
                        }
                      />
                      <TimePair
                        prefix="до"
                        value={dayEnd}
                        onChange={(v) =>
                          setDayOverride(k, {
                            ...ensureOverride(k),
                            is_working: true,
                            end: v,
                          })
                        }
                      />
                    </div>
                    <PerDayBreaks
                      breaks={dayBreaks}
                      onChange={(bb) =>
                        setDayOverride(k, {
                          ...ensureOverride(k),
                          is_working: true,
                          breaks: bb,
                        })
                      }
                    />
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
        className="w-full h-9 rounded-[10px] bg-[var(--surface-card)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
      >
        <Plus size={14} strokeWidth={2.5} />
        Добавить перерыв
      </button>
    );
  }

  return (
    <div className="space-y-2">
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
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--system-red)] press-scale"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full h-9 rounded-[10px] bg-[var(--surface-card)] flex items-center justify-center gap-1.5 text-[var(--accent)] text-[13px] font-medium press-scale"
      >
        <Plus size={14} strokeWidth={2.5} />
        Ещё перерыв
      </button>
    </div>
  );
}
