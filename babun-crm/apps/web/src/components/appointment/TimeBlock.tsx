"use client";

import { useEffect, useMemo, useState } from "react";
import WheelColumn from "./WheelColumn";

interface TimeBlockProps {
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  timeEnd: string; // HH:MM
  readOnly?: boolean;
  onChange: (next: { date: string; timeStart: string; timeEnd: string }) => void;
}

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MIN_STEP = 5;
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 / MIN_STEP }, (_, i) => pad2(i * MIN_STEP));
const ITEM_HEIGHT = 38;
const VISIBLE_ROWS = 5;
const COLUMN_WIDTH = 56;
const WHEEL_H = ITEM_HEIGHT * VISIBLE_ROWS; // 190
const PAD = (WHEEL_H - ITEM_HEIGHT) / 2;    // 76
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

// STORY-009 premium time block. Collapsed by default as a clean white
// summary row; expanded shows a centred week strip with chevron nav,
// two iOS-style wheel pairs (hour : minute → hour : minute) and a
// pill-styled duration readout. The wheel pairs are infinite-loop,
// so the user can scroll from 00 minutes upward to 55 and beyond
// without hitting a wall.
export default function TimeBlock({
  date,
  timeStart,
  timeEnd,
  readOnly,
  onChange,
}: TimeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    // Resync the viewed week to the appointment's date. When the
    // selected date lands inside the current view the setState is a
    // React-level no-op; only an out-of-view date (e.g. sheet reused
    // for a different record) actually triggers a re-render.
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
      <div className="px-4 py-3 bg-white border-b border-slate-100 text-[13px] text-slate-800 tabular-nums">
        {formatDateRu(date)} · {timeStart}–{timeEnd}
        {duration > 0 && <span className="text-slate-500 ml-1">· {duration} мин</span>}
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100 text-[13px] text-slate-600 active:bg-slate-50"
      >
        <span className="flex-shrink-0 text-slate-400">
          <ClockIcon />
        </span>
        <span className="font-semibold text-slate-900">{formatDateRu(date)}</span>
        <span className="text-slate-300">·</span>
        <span className="tabular-nums font-medium">
          {timeStart}–{timeEnd}
        </span>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 tabular-nums">
          {duration} мин
        </span>
        <span className="flex-shrink-0 text-slate-400">
          <ChevronDownIcon />
        </span>
      </button>
    );
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
    <div
      className="border-b border-slate-100"
      style={{ background: "linear-gradient(180deg, #fafafa, #f5f3ff)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
          Время записи
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-7 h-7 flex items-center justify-center text-slate-400 active:text-slate-700"
          aria-label="Свернуть"
        >
          <ChevronUpIcon />
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <WeekArrow direction="prev" disabled={!canPrev} onClick={() => setWeekOffset((o) => Math.max(WEEK_OFFSET_MIN, o - 1))} />
        <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto">
          {week.map((d) => {
            const active = d.key === date;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onChange({ date: d.key, timeStart, timeEnd })}
                className="flex-shrink-0 flex flex-col items-center justify-center transition-transform active:scale-95"
                style={{
                  width: 48,
                  height: 60,
                  borderRadius: 14,
                  color: active ? "white" : d.isToday ? "rgb(124 58 237)" : "rgb(71 85 105)",
                  background: active
                    ? "linear-gradient(180deg, #8b5cf6, #7c3aed)"
                    : "white",
                  border: active
                    ? "1px solid transparent"
                    : d.isToday
                    ? "1.5px solid rgb(167 139 250)"
                    : "1px solid rgb(226 232 240)",
                  boxShadow: active
                    ? "0 4px 12px rgba(124, 58, 237, 0.28)"
                    : "0 1px 2px rgba(15, 23, 42, 0.04)",
                  transform: active ? "scale(1.02)" : "scale(1)",
                }}
              >
                <span
                  className="leading-none"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    opacity: active ? 0.88 : 1,
                    letterSpacing: "0.04em",
                  }}
                >
                  {d.weekday}
                </span>
                <span
                  className="leading-tight"
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  {d.day}
                </span>
              </button>
            );
          })}
        </div>
        <WeekArrow direction="next" disabled={!canNext} onClick={() => setWeekOffset((o) => Math.min(WEEK_OFFSET_MAX, o + 1))} />
      </div>

      {/* Week range label */}
      <div
        className="text-center mt-1.5"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "rgb(148 163 184)",
          textTransform: "uppercase",
        }}
      >
        {weekRangeLabel}
      </div>

      {/* Wheels */}
      <div className="mt-3 flex items-center justify-center gap-2 px-3">
        <WheelGroup
          hourIdx={startHourIdx}
          minIdx={startMinIdx}
          onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
          onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
        />
        <span className="flex-shrink-0 text-slate-400">
          <ArrowRightIcon />
        </span>
        <WheelGroup
          hourIdx={endHourIdx}
          minIdx={endMinIdx}
          onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
          onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
        />
      </div>

      {/* Duration pill */}
      <div className="mt-3 pb-4 flex justify-center">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full tabular-nums"
          style={{
            background: "rgb(241 245 249)",
            fontSize: 12,
            fontWeight: 600,
            color: "rgb(71 85 105)",
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: "rgb(148 163 184)",
            }}
          />
          {duration} минут
        </div>
      </div>

      <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
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
      className="flex-shrink-0 flex items-center justify-center transition active:scale-95 disabled:opacity-30"
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "white",
        border: "1px solid rgb(226 232 240)",
        color: "rgb(71 85 105)",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
      }}
      aria-label={direction === "prev" ? "Предыдущая неделя" : "Следующая неделя"}
    >
      {direction === "prev" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}

function WheelGroup({
  hourIdx,
  minIdx,
  onHour,
  onMin,
}: {
  hourIdx: number;
  minIdx: number;
  onHour: (idx: number) => void;
  onMin: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
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
          fontSize: 24,
          fontWeight: 300,
          color: "rgb(203 213 225)",
          padding: "0 2px",
          lineHeight: `${WHEEL_H}px`,
        }}
      >
        :
      </span>
      <WheelWithLines>
        <WheelColumn
          items={MINUTES}
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
  // Two 1px slate lines at the top and bottom of the centre row —
  // iOS-style selection markers. No violet bar; the text inside the
  // centre row does the heavy lifting.
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: 4,
          right: 4,
          top: PAD,
          height: 1,
          background: "rgba(15, 23, 42, 0.12)",
        }}
      />
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: 4,
          right: 4,
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
function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}
