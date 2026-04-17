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
const ITEM_HEIGHT = 26;
const VISIBLE_COUNT = 3;
// Don't let the dispatcher scroll into 2050 by accident; ±6 months
// covers every realistic service-business horizon.
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

// STORY-008 inline time block — collapsed by default, tap to expand.
// Expanded view: 7 centred day cubes with ◀ ▶ week nav, two wheel
// pairs for start/end, and a read-only duration pill. Week nav
// shifts only the VIEWED week; the appointment's date updates only
// when the dispatcher taps a specific cube.
export default function TimeBlock({
  date,
  timeStart,
  timeEnd,
  readOnly,
  onChange,
}: TimeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Re-anchor the visible week to the appointment's date whenever the
  // parent hands us a date that sits outside the currently-displayed
  // week (e.g. sheet reopened on a different record). Tapping a cube
  // inside the current view is a no-op here because mondayOf(newDate)
  // already equals the current anchor → React bails on same-state.
  useEffect(() => {
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
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[13px] text-slate-800 tabular-nums">
        {formatDateRu(date)} · {timeStart}–{timeEnd}
        {duration > 0 && <span className="text-slate-500 ml-1">· {duration}м</span>}
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full px-4 py-2 text-left flex items-center gap-2 text-[13px] text-slate-700 bg-slate-50 border-b border-slate-100 active:bg-slate-100"
      >
        <span className="text-slate-400">🕐</span>
        <span className="tabular-nums">
          {formatDateRu(date)} · {timeStart}–{timeEnd}
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500 tabular-nums">{duration}м</span>
        <span className="ml-auto text-slate-400">▾</span>
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
    <div className="bg-slate-50 border-b border-slate-100">
      {/* Header row: title + collapse button */}
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Время записи
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-7 h-7 flex items-center justify-center text-slate-400 active:text-slate-600"
          aria-label="Свернуть"
        >
          ▴
        </button>
      </div>

      {/* Week nav row: ◀ cubes ▶ */}
      <div className="flex items-center gap-1 px-2 pt-1">
        <WeekNavBtn
          direction="prev"
          disabled={!canPrev}
          onClick={() => setWeekOffset((o) => Math.max(WEEK_OFFSET_MIN, o - 1))}
        />
        <div className="flex-1 flex items-center justify-center gap-1 overflow-x-auto">
          {week.map((d) => {
            const active = d.key === date;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onChange({ date: d.key, timeStart, timeEnd })}
                className={`flex-shrink-0 w-10 h-12 rounded-xl flex flex-col items-center justify-center text-[11px] font-semibold transition ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                } ${d.isToday && !active ? "border-violet-400 text-violet-700" : ""}`}
              >
                <span className="opacity-75 leading-none">{d.weekday}</span>
                <span className="text-[15px] font-bold leading-tight">{d.day}</span>
              </button>
            );
          })}
        </div>
        <WeekNavBtn
          direction="next"
          disabled={!canNext}
          onClick={() => setWeekOffset((o) => Math.min(WEEK_OFFSET_MAX, o + 1))}
        />
      </div>

      {/* Week range label */}
      <div className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
        {weekRangeLabel}
      </div>

      {/* Wheels */}
      <div className="mt-2 flex items-center justify-center gap-1 px-4">
        <WheelGroup
          hourIdx={startHourIdx}
          minIdx={startMinIdx}
          onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
          onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
        />
        <div className="w-6 text-center text-[16px] font-bold text-slate-400 select-none">
          →
        </div>
        <WheelGroup
          hourIdx={endHourIdx}
          minIdx={endMinIdx}
          onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
          onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
        />
      </div>

      {/* Duration pill — display only */}
      <div className="mt-2 pb-3 flex justify-center">
        <div className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 tabular-nums">
          {duration}м
        </div>
      </div>

      <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
    </div>
  );
}

function WeekNavBtn({
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
      className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] text-slate-500 active:bg-slate-100 disabled:opacity-30"
      aria-label={direction === "prev" ? "Предыдущая неделя" : "Следующая неделя"}
    >
      {direction === "prev" ? "◀" : "▶"}
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
      <WheelColumn
        items={HOURS}
        selectedIndex={hourIdx}
        onChange={onHour}
        width={44}
        itemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE_COUNT}
      />
      <div className="h-[78px] flex items-center text-sm font-bold text-slate-300 select-none">
        :
      </div>
      <WheelColumn
        items={MINUTES}
        selectedIndex={minIdx}
        onChange={onMin}
        width={44}
        itemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE_COUNT}
      />
    </div>
  );
}
