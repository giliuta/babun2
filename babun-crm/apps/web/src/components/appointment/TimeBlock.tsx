"use client";

import { useMemo } from "react";
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
// Scroll-snap: the column is 78px tall with 26px per row → 3 visible
// rows, the middle one lives in the selection bar. Matching the
// WheelColumn defaults keeps the scroll maths consistent.
const ITEM_HEIGHT = 26;
const VISIBLE_COUNT = 3;

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

// STORY-007 inline time block: 7-cube week strip on top, two pairs of
// wheel columns (start / end) side by side with an arrow separator,
// and a centred duration pill underneath. Designed for the
// appointment sheet — always visible, never modal.
export default function TimeBlock({
  date,
  timeStart,
  timeEnd,
  readOnly,
  onChange,
}: TimeBlockProps) {
  const [sh, sm] = parseTime(timeStart);
  const [eh, em] = parseTime(timeEnd);

  // Roll minutes to the nearest tick so the wheels can show a valid
  // index even if the appointment was stored with a custom value
  // (e.g. 16:17). onChange still emits a clean HH:MM.
  const startMinRounded = Math.floor(sm / MIN_STEP) * MIN_STEP;
  const endMinRounded = Math.floor(em / MIN_STEP) * MIN_STEP;

  const startHourIdx = Math.max(0, Math.min(23, sh));
  const startMinIdx = startMinRounded / MIN_STEP;
  const endHourIdx = Math.max(0, Math.min(23, eh));
  const endMinIdx = endMinRounded / MIN_STEP;

  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const duration = Math.max(0, endTotal - startTotal);

  const week = useMemo(() => {
    const monday = mondayOf(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        key: dateToKey(d),
        weekday: WEEKDAYS[i],
        day: d.getDate(),
        isToday: sameYMD(d, today),
      };
    });
  }, [date]);

  if (readOnly) {
    const active = week.find((d) => d.key === date);
    const label = active ? `${active.weekday} ${active.day}` : date;
    return (
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[13px] text-slate-800 tabular-nums">
        {label} · {timeStart}–{timeEnd}
        {duration > 0 && <span className="text-slate-500 ml-1">· {duration}м</span>}
      </div>
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
    // Illegal — end must strictly follow start. Ignore; WheelColumn's
    // selectedIndex sync will snap the wheel back on the next render.
    if (nextEndTotal <= startTotal) return;
    const nextEnd = `${pad2(hour)}:${pad2(min)}`;
    onChange({ date, timeStart, timeEnd: nextEnd });
  };

  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
      {/* Week strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {week.map((d) => {
          const active = d.key === date;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onChange({ date: d.key, timeStart, timeEnd })}
              className={`flex-shrink-0 w-11 h-12 rounded-xl flex flex-col items-center justify-center text-[11px] font-semibold transition ${
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

      {/* Wheels */}
      <div className="mt-2 flex items-center justify-center gap-1">
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
      <div className="mt-2 flex justify-center">
        <div className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 tabular-nums">
          {duration}м
        </div>
      </div>

      {/* One-off webkit scrollbar hide for the wheel scrollers. */}
      <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
    </div>
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
