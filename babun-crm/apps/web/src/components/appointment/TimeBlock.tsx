"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WheelColumn from "./WheelColumn";

interface TimeBlockProps {
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  timeEnd: string; // HH:MM
  readOnly?: boolean;
  onChange: (next: { date: string; timeStart: string; timeEnd: string }) => void;
  /** Optional element rendered at the right edge of the header row.
   *  Used by PersonalEventSheet to drop the «Весь день» toggle in
   *  line with the date/time chips so the user gets one compact row.
   *  When set, the duration pill is hidden to make room. */
  rightSlot?: React.ReactNode;
  /** Brief 1 #2: minutes granularity for the wheel — driven by the
   *  active team's `default_slot_minutes` (15 / 30 / 60). Falls back
   *  to 5 for personal events and legacy callers. */
  stepMinutes?: number;
}

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
// Wheel minute step. Caller-controlled via `stepMinutes`. Acceptable
// divisors of 60 only (5, 10, 15, 20, 30, 60); other values silently
// clamp to 5 so the wheel never gets a non-evenly-spaced list.
const VALID_MIN_STEPS = new Set([5, 10, 15, 20, 30, 60]);
// STORY-010 compact dimensions. Item 30 × 3 rows = 90 px wheel height,
// about half what STORY-009 shipped.
const ITEM_HEIGHT = 30;
const VISIBLE_ROWS = 3;
const COLUMN_WIDTH = 44;
const WHEEL_H = ITEM_HEIGHT * VISIBLE_ROWS;
const PAD = (WHEEL_H - ITEM_HEIGHT) / 2;
const WEEK_OFFSET_MIN = -24;
const WEEK_OFFSET_MAX = 24;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseTime(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}
function minutesToHHMM(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}
function mondayOf(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function stripDot(s: string): string {
  return s.replace(/\.$/, "");
}
function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return stripDot(
    dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  );
}
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monthShort = (d: Date) =>
    stripDot(d.toLocaleDateString("ru-RU", { month: "short" }));
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.getDate()} ${monthShort(sunday)}`;
  }
  return `${monday.getDate()} ${monthShort(monday)} – ${sunday.getDate()} ${monthShort(sunday)}`;
}

// STORY-010 compact TimeBlock. All seven day cubes share the row via
// flex-1 (no overflow, no horizontal scroll, cubes resize to the
// available width). The week-range label and duration share one thin
// uppercase row — the duration pill from STORY-009 went away. Wheels
// shrank to 3 visible rows. Expanded height now lands around ~180 px.
export default function TimeBlock({
  date,
  timeStart,
  timeEnd,
  readOnly,
  onChange,
  rightSlot,
  stepMinutes,
}: TimeBlockProps) {
  const [expandedMode, setExpandedMode] = useState<"none" | "date" | "time">(
    "none"
  );
  const [weekOffset, setWeekOffset] = useState(0);
  // v570 — swipe-to-change-date refs. Declared BEFORE the readOnly
  // early-return below so hook order stays stable between render
  // paths (rules-of-hooks). The read-only path doesn't touch them
  // but the cost of two unused refs is nil.
  const swipeStartXRef = useRef<number | null>(null);
  const wasSwipeRef = useRef(false);

  // Brief 1 #2: resolve the effective wheel step. Clamp unknown / out-
  // of-range values to 5 so we never build a non-evenly-spaced wheel
  // list (e.g. caller passes 7 → wheel would skip past 56).
  const MIN_STEP =
    stepMinutes && VALID_MIN_STEPS.has(stepMinutes) ? stepMinutes : 5;
  const MINUTES = useMemo(
    () => Array.from({ length: 60 / MIN_STEP }, (_, i) => pad2(i * MIN_STEP)),
    [MIN_STEP]
  );

  useEffect(() => {
    // Resync the viewed week to the appointment's date. When the
    // date lands inside the current view the setState is a no-op;
    // only an out-of-view date triggers a real re-render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeekOffset(0);
  }, [date]);

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

  const viewMonday = useMemo(() => {
    const base = mondayOf(date);
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [date, weekOffset]);

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

  if (readOnly) {
    return (
      <div className="px-4 py-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-[13px] text-[var(--label)] tabular-nums">
        {formatDateRu(date)} · {timeStart}–{timeEnd}
        {duration > 0 && <span className="text-[var(--label-secondary)] ml-1">· {duration} мин</span>}
      </div>
    );
  }

  const toggle = (mode: "date" | "time") =>
    setExpandedMode((prev) => (prev === mode ? "none" : mode));

  // v469 — swipe-to-change-date on the date pill. Touch handlers live
  // on the pill button itself; horizontal drag > 40 px → ±1 day.
  // wasSwipeRef gates the synthetic click so that swiping doesn't
  // also expand the date picker. Reset after each gesture. Refs
  // themselves are declared at the top of the component (see v570
  // hook-ordering note above).
  const handleDatePillTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeStartXRef.current = e.touches[0].clientX;
    wasSwipeRef.current = false;
  };
  const handleDatePillTouchEnd = (e: React.TouchEvent) => {
    const startX = swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) < 40) return;
    wasSwipeRef.current = true;
    const [yy, mm, dd] = date.split("-").map(Number);
    const dt = new Date(yy, mm - 1, dd);
    dt.setDate(dt.getDate() + (dx < 0 ? 1 : -1));
    const nextKey = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    onChange({ date: nextKey, timeStart, timeEnd });
  };
  const handleDatePillClick = () => {
    // Synthetic click that follows a horizontal swipe — ignore so the
    // user doesn't accidentally expand the picker after a drag.
    if (wasSwipeRef.current) {
      wasSwipeRef.current = false;
      return;
    }
    toggle("date");
  };

  const headerRow = (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-card)] border-b border-[var(--separator)] text-[13px]">
      <span className="flex-shrink-0 text-[var(--label-tertiary)]">
        <ClockIcon />
      </span>
      <button
        type="button"
        onClick={handleDatePillClick}
        onTouchStart={handleDatePillTouchStart}
        onTouchEnd={handleDatePillTouchEnd}
        aria-label="Дата — тап раскрывает выбор, свайп меняет день"
        className={`flex items-center gap-1 rounded-lg px-2 py-1 transition active:scale-[0.98] ${
          expandedMode === "date"
            ? "bg-[var(--accent-tint)] text-[var(--accent)]"
            : "text-[var(--label)] active:bg-[var(--fill-quaternary)]"
        }`}
      >
        <span className="font-semibold">{formatDateRu(date)}</span>
        <ChevronDownIcon />
      </button>
      <button
        type="button"
        onClick={() => toggle("time")}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 transition tabular-nums active:scale-[0.98] ${
          expandedMode === "time"
            ? "bg-[var(--accent-tint)] text-[var(--accent)]"
            : "text-[var(--label)] active:bg-[var(--fill-quaternary)]"
        }`}
      >
        <span className="font-medium">
          {timeStart}–{timeEnd}
        </span>
        <ChevronDownIcon />
      </button>
      {rightSlot ? (
        <span className="ml-auto flex items-center">{rightSlot}</span>
      ) : (
        <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--fill-tertiary)] text-[12px] font-semibold text-[var(--label-secondary)] tabular-nums">
          {duration} мин
        </span>
      )}
    </div>
  );

  if (expandedMode === "none") {
    return headerRow;
  }

  const commitStart = (hour: number, min: number) => {
    const nextStart = `${pad2(hour)}:${pad2(min)}`;
    const nextStartTotal = hour * 60 + min;
    let nextEnd = timeEnd;
    if (endTotal <= nextStartTotal) {
      nextEnd = minutesToHHMM(nextStartTotal + 60);
    }
    onChange({ date, timeStart: nextStart, timeEnd: nextEnd });
  };

  const commitEnd = (hour: number, min: number) => {
    const nextEndTotal = hour * 60 + min;
    if (nextEndTotal <= startTotal) return;
    const nextEnd = `${pad2(hour)}:${pad2(min)}`;
    onChange({ date, timeStart, timeEnd: nextEnd });
  };

  const canPrev = weekOffset > WEEK_OFFSET_MIN;
  const canNext = weekOffset < WEEK_OFFSET_MAX;

  return (
    <>
      {headerRow}
      <div
        className="border-b border-[var(--separator)]"
        style={{
          padding: "10px 10px 12px",
          background: "var(--surface-grouped)",
        }}
      >
        {expandedMode === "date" && (
          <>
            {/* Week picker: prev / 7 cubes / next */}
            <div className="flex items-center gap-2">
              <WeekArrow
                direction="prev"
                disabled={!canPrev}
                onClick={() => setWeekOffset((o) => Math.max(WEEK_OFFSET_MIN, o - 1))}
              />
              <div className="flex-1 flex items-stretch gap-1 min-w-0">
                {week.map((d) => {
                  const active = d.key === date;
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
                        background: active
                          ? "var(--accent)"
                          : "var(--surface-card)",
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
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
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

            <div
              className="flex items-center justify-center"
              style={{
                marginTop: 6,
                gap: 8,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--label-secondary)",
              }}
            >
              <span>{weekRangeLabel}</span>
            </div>
          </>
        )}

        {expandedMode === "time" && (
          <>
            <div className="flex items-center justify-center">
              <WheelGroup
                minutes={MINUTES}
                hourIdx={startHourIdx}
                minIdx={startMinIdx}
                onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
                onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
              />
              <span
                className="flex-shrink-0 text-[var(--label-tertiary)] select-none"
                style={{ padding: "0 8px", lineHeight: `${WHEEL_H}px` }}
              >
                <ArrowRightIcon />
              </span>
              <WheelGroup
                minutes={MINUTES}
                hourIdx={endHourIdx}
                minIdx={endMinIdx}
                onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
                onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
              />
            </div>
            {/* Brief 1 #2: keyboard text input as a parallel surface to
                the wheels. Two `<input type="time">` boxes:
                  - desktop: free typing, e.g. «11:45»
                  - mobile: opens the native time picker which respects
                    the `step` attribute (seconds)
                Both feed back through onChange, snapping to the team's
                step on commit (next clamp). Empty / invalid values are
                ignored so a half-typed entry doesn't blow up state. */}
            <div className="mt-2 flex items-center justify-center gap-2 text-[13px] text-[var(--label-secondary)] tabular-nums">
              <input
                type="time"
                value={timeStart}
                step={MIN_STEP * 60}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!/^\d{2}:\d{2}$/.test(v)) return;
                  const [h, m] = v.split(":").map(Number);
                  commitStart(h, m);
                }}
                aria-label="Время начала"
                className="h-9 px-2 rounded-lg bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] text-[14px] font-semibold focus:outline-none focus:border-[var(--accent)]"
              />
              <span aria-hidden>—</span>
              <input
                type="time"
                value={timeEnd}
                step={MIN_STEP * 60}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!/^\d{2}:\d{2}$/.test(v)) return;
                  const [h, m] = v.split(":").map(Number);
                  commitEnd(h, m);
                }}
                aria-label="Время окончания"
                className="h-9 px-2 rounded-lg bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] text-[14px] font-semibold focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </>
        )}

        <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
      </div>
    </>
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
        width: 30,
        height: 30,
        borderRadius: 999,
        background: "var(--surface-card)",
        border: "1px solid var(--separator)",
        color: "var(--label-secondary)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
      aria-label={direction === "prev" ? "Предыдущая неделя" : "Следующая неделя"}
    >
      {direction === "prev" ? <ChevronLeftIcon size={14} /> : <ChevronRightIcon size={14} />}
    </button>
  );
}

function WheelGroup({
  minutes,
  hourIdx,
  minIdx,
  onHour,
  onMin,
}: {
  minutes: string[];
  hourIdx: number;
  minIdx: number;
  onHour: (idx: number) => void;
  onMin: (idx: number) => void;
}) {
  return (
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
  );
}

function WheelWithLines({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: 3,
          right: 3,
          top: PAD,
          height: 1,
          background: "rgba(15, 23, 42, 0.12)",
        }}
      />
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: 3,
          right: 3,
          top: PAD + ITEM_HEIGHT - 1,
          height: 1,
          background: "rgba(15, 23, 42, 0.12)",
        }}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function ChevronLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}
