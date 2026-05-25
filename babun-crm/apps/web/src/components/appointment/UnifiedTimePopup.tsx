"use client";

/**
 * UnifiedTimePopup — one centred modal for picking date + start/end
 * time, shared by «Клиент» (work) and «Событие». Unlike the legacy
 * TimeBlock (which toggled date OR time), everything is visible at
 * once: week-day squares on top, then «Начало» / «Конец» wheel
 * columns side by side, plus an «весь день» toggle. Work context also
 * gets quick-fill chips and duration presets.
 *
 * Block-2 redesign — see docs/stories plan. Replaces TimePopup.
 */

import { useEffect, useMemo, useState } from "react";
import WheelColumn from "./WheelColumn";
import { IOSSwitch } from "@/components/ui";
import {
  HOURS,
  pad2,
  dateToKey,
  parseTime,
  minutesToHHMM,
  mondayOf,
  sameYMD,
  formatDateRu,
  formatWeekRange,
  resolveStep,
  WEEKDAYS,
} from "@/lib/time-block-utils";

interface UnifiedTimePopupProps {
  open: boolean;
  onClose: () => void;
  /** work context unlocks quick-fill chips + duration presets. */
  context: "work" | "event";
  readonly: boolean;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
  showAllDay: boolean;
  /** Wheel granularity (team default_slot_minutes for work, 5 for event). */
  stepMinutes?: number;
  onChange: (next: { date: string; timeStart: string; timeEnd: string }) => void;
  onAllDayChange: (next: boolean) => void;
}

const ITEM_HEIGHT = 30;
const VISIBLE_ROWS = 3;
const COLUMN_WIDTH = 44;
const WHEEL_H = ITEM_HEIGHT * VISIBLE_ROWS;
const PAD = (WHEEL_H - ITEM_HEIGHT) / 2;
const WEEK_OFFSET_MIN = -24;
const WEEK_OFFSET_MAX = 24;
const PRESET_DURATIONS = [30, 60, 90, 120] as const;

function formatDateKey(d: Date): string {
  return dateToKey(d);
}
function formatTimeMin(mins: number): string {
  return minutesToHHMM(mins);
}

export default function UnifiedTimePopup({
  open,
  onClose,
  context,
  readonly,
  dateKey,
  timeStart,
  timeEnd,
  allDay,
  showAllDay,
  stepMinutes,
  onChange,
  onAllDayChange,
}: UnifiedTimePopupProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  useEffect(() => {
    // Resync the viewed week to the appointment's date on open / date change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeekOffset(0);
  }, [dateKey, open]);

  const MIN_STEP = resolveStep(stepMinutes);
  const MINUTES = useMemo(
    () => Array.from({ length: 60 / MIN_STEP }, (_, i) => pad2(i * MIN_STEP)),
    [MIN_STEP],
  );

  const viewMonday = useMemo(() => {
    const base = mondayOf(dateKey);
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [dateKey, weekOffset]);

  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(viewMonday);
      d.setDate(viewMonday.getDate() + i);
      return {
        key: dateToKey(d),
        weekday: WEEKDAYS[i],
        day: d.getDate(),
        isToday: sameYMD(d, today),
      };
    });
  }, [viewMonday]);

  const weekRangeLabel = useMemo(() => formatWeekRange(viewMonday), [viewMonday]);

  if (!open) return null;

  const [sh, sm] = parseTime(timeStart);
  const [eh, em] = parseTime(timeEnd);
  const startMinRounded = Math.floor(sm / MIN_STEP) * MIN_STEP;
  const endMinRounded = Math.floor(em / MIN_STEP) * MIN_STEP;
  const startHourIdx = Math.max(0, Math.min(23, sh));
  const startMinIdx = startMinRounded / MIN_STEP;
  const endHourIdx = Math.max(0, Math.min(23, eh));
  const endMinIdx = endMinRounded / MIN_STEP;
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const duration = Math.max(0, endTotal - startTotal);

  const step = MIN_STEP;

  const commitStart = (hour: number, min: number) => {
    const nextStart = `${pad2(hour)}:${pad2(min)}`;
    const nextStartTotal = hour * 60 + min;
    let nextEnd = timeEnd;
    if (endTotal <= nextStartTotal) {
      nextEnd = minutesToHHMM(nextStartTotal + 60);
    }
    onChange({ date: dateKey, timeStart: nextStart, timeEnd: nextEnd });
  };
  const commitEnd = (hour: number, min: number) => {
    const nextEndTotal = hour * 60 + min;
    if (nextEndTotal <= startTotal) return;
    onChange({ date: dateKey, timeStart, timeEnd: `${pad2(hour)}:${pad2(min)}` });
  };

  const applyQuickFill = (d: Date, startMin: number) => {
    const dur = duration > 0 ? duration : step;
    onChange({
      date: formatDateKey(d),
      timeStart: formatTimeMin(startMin),
      timeEnd: formatTimeMin(startMin + dur),
    });
  };
  const quickChips = [
    {
      label: "Сейчас",
      onClick: () => {
        const n = new Date();
        const m = n.getHours() * 60 + n.getMinutes();
        applyQuickFill(n, Math.ceil((m + 1) / step) * step);
      },
    },
    {
      label: "Через час",
      onClick: () => {
        const n = new Date();
        const m = n.getHours() * 60 + n.getMinutes();
        applyQuickFill(n, Math.ceil((m + 1) / step) * step + 60);
      },
    },
    {
      label: "Завтра",
      onClick: () => {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        applyQuickFill(t, 9 * 60);
      },
    },
  ];

  const applyDuration = (mins: number) => {
    const nextEndTotal = startTotal + mins;
    onChange({ date: dateKey, timeStart, timeEnd: minutesToHHMM(nextEndTotal) });
  };

  const canPrev = weekOffset > WEEK_OFFSET_MIN;
  const canNext = weekOffset < WEEK_OFFSET_MAX;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between border-b border-[var(--separator)]">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Время записи
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Готово
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* «Весь день» toggle */}
          {showAllDay && !readonly && (
            <div className="flex items-center justify-between px-3 h-11 rounded-[12px] bg-[var(--fill-tertiary)]">
              <span className="text-[14px] font-semibold text-[var(--label)]">
                Весь день
              </span>
              <IOSSwitch
                checked={allDay}
                onChange={(v) => onAllDayChange(v)}
                ariaLabel="Весь день"
              />
            </div>
          )}

          {/* Quick-fill chips — work create only */}
          {context === "work" && !readonly && (
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {quickChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.onClick}
                  className="flex-shrink-0 px-4 h-11 rounded-full text-[14px] font-semibold bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)] active:scale-[0.97]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Week-day squares — always visible */}
          <div className="flex items-center gap-2">
            <WeekArrow
              direction="prev"
              disabled={!canPrev}
              onClick={() => setWeekOffset((o) => Math.max(WEEK_OFFSET_MIN, o - 1))}
            />
            <div className="flex-1 flex items-stretch gap-1 min-w-0">
              {week.map((d) => {
                const active = d.key === dateKey;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onChange({ date: d.key, timeStart, timeEnd })}
                    className="flex flex-col items-center justify-center transition active:scale-[0.97]"
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      height: 48,
                      borderRadius: 10,
                      gap: 1,
                      background: active ? "var(--accent)" : "var(--surface-card)",
                      border: active
                        ? "1px solid transparent"
                        : d.isToday
                          ? "1px solid var(--accent)"
                          : "1px solid var(--separator)",
                      color: active
                        ? "white"
                        : d.isToday
                          ? "var(--accent)"
                          : "var(--label)",
                      boxShadow: active
                        ? "0 3px 10px rgba(124, 58, 237, 0.28)"
                        : "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        color: active
                          ? "rgba(255,255,255,0.82)"
                          : d.isToday
                            ? "var(--accent)"
                            : "var(--label-secondary)",
                        lineHeight: 1,
                      }}
                    >
                      {d.weekday}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}
                    >
                      {d.day}
                    </span>
                  </button>
                );
              })}
            </div>
            <WeekArrow
              direction="next"
              disabled={!canNext}
              onClick={() => setWeekOffset((o) => Math.min(WEEK_OFFSET_MAX, o + 1))}
            />
          </div>
          <div className="text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
            {weekRangeLabel}
          </div>

          {/* Start / End wheel columns — both visible at once. Hidden
              when all-day (the day squares above are the whole input). */}
          {!allDay && (
            <div className="flex items-start justify-center gap-3 pt-1">
              <WheelSide
                label="Начало"
                dateLabel={formatDateRu(dateKey)}
                minutes={MINUTES}
                hourIdx={startHourIdx}
                minIdx={startMinIdx}
                onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
                onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
              />
              <WheelSide
                label="Конец"
                dateLabel={formatDateRu(dateKey)}
                minutes={MINUTES}
                hourIdx={endHourIdx}
                minIdx={endMinIdx}
                onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
                onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
              />
            </div>
          )}

          {/* Duration presets — work editable only, hidden when all-day */}
          {context === "work" && !readonly && !allDay && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] flex-shrink-0 mr-1">
                Длит.
              </span>
              {PRESET_DURATIONS.map((m) => {
                const active = duration === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyDuration(m)}
                    className={`flex-shrink-0 px-4 h-11 rounded-full text-[14px] font-semibold transition active:scale-[0.97] tabular-nums ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)]"
                    }`}
                  >
                    {m}м
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
      </div>
    </div>
  );
}

function WheelSide({
  label,
  dateLabel,
  minutes,
  hourIdx,
  minIdx,
  onHour,
  onMin,
}: {
  label: string;
  dateLabel: string;
  minutes: string[];
  hourIdx: number;
  minIdx: number;
  onHour: (idx: number) => void;
  onMin: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        {label}
      </span>
      <span className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
        {dateLabel}
      </span>
      <div className="flex items-center">
        <WheelWithLines>
          <WheelColumn
            items={HOURS}
            selectedIndex={hourIdx}
            onChange={onHour}
            width={COLUMN_WIDTH}
            itemHeight={ITEM_HEIGHT}
            visibleRows={VISIBLE_ROWS}
            loop
          />
        </WheelWithLines>
        <span
          className="select-none"
          style={{
            fontSize: 18,
            fontWeight: 300,
            color: "var(--label-tertiary)",
            padding: "0 2px",
            lineHeight: `${WHEEL_H}px`,
          }}
        >
          :
        </span>
        <WheelWithLines>
          <WheelColumn
            items={minutes}
            selectedIndex={minIdx}
            onChange={onMin}
            width={COLUMN_WIDTH}
            itemHeight={ITEM_HEIGHT}
            visibleRows={VISIBLE_ROWS}
            loop
          />
        </WheelWithLines>
      </div>
    </div>
  );
}

function WheelWithLines({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: 3, right: 3, top: PAD, height: 1, background: "rgba(15, 23, 42, 0.12)" }}
      />
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: 3, right: 3, top: PAD + ITEM_HEIGHT - 1, height: 1, background: "rgba(15, 23, 42, 0.12)" }}
      />
    </div>
  );
}

function WeekArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-shrink-0 flex items-center justify-center transition active:scale-[0.92] disabled:opacity-30"
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        background: "var(--surface-card)",
        border: "1px solid var(--separator)",
        color: "var(--label-secondary)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
      aria-label={direction === "prev" ? "Предыдущая неделя" : "Следующая неделя"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {direction === "prev" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}
