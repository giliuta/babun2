"use client";

import { useMemo } from "react";
import WheelColumn from "./WheelColumn";

interface CompactWheelPickerProps {
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  timeEnd: string; // HH:MM
  onChange: (next: { date: string; timeStart: string; timeEnd: string }) => void;
}

const DAYS_BACK = 7;
const DAYS_FWD = 30;
const HOUR_MIN = 7;
const HOUR_MAX = 21;
const MIN_STEP = 5;
const MIN_DURATION = 15;

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

function formatDateShort(d: Date): string {
  // "ПН 18 апр" — Russian short weekday + day + short month.
  // toLocaleDateString adds trailing dots on Russian abbreviations;
  // strip them for a tight label that fits the 110 px column.
  const weekday = d
    .toLocaleDateString("ru-RU", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  return `${weekday} ${dayNum} ${month}`;
}

export default function CompactWheelPicker({
  date,
  timeStart,
  timeEnd,
  onChange,
}: CompactWheelPickerProps) {
  // Date list: fixed window around today. Rebuilt only on mount so the
  // index math stays stable across renders (today at position DAYS_BACK).
  const { dateKeys, dateLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const keys: string[] = [];
    const labels: string[] = [];
    for (let i = -DAYS_BACK; i <= DAYS_FWD; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      keys.push(dateToKey(d));
      labels.push(formatDateShort(d));
    }
    return { dateKeys: keys, dateLabels: labels };
  }, []);

  const hourLabels = useMemo(() => {
    const out: string[] = [];
    for (let h = HOUR_MIN; h <= HOUR_MAX; h++) out.push(pad2(h));
    return out;
  }, []);

  const minLabels = useMemo(() => {
    const out: string[] = [];
    for (let m = 0; m < 60; m += MIN_STEP) out.push(pad2(m));
    return out;
  }, []);

  // Resolve current selection from props. Clamp anything outside the
  // wheel window so scrollTop stays valid even for seed data from the
  // grid (e.g. a 6 AM tap on an unusual slot).
  const dateIdx = (() => {
    const i = dateKeys.indexOf(date);
    if (i >= 0) return i;
    return DAYS_BACK; // fall back to "today"
  })();

  const [sh, sm] = parseTime(timeStart);
  const clampedHour = Math.max(HOUR_MIN, Math.min(HOUR_MAX, sh));
  const hourIdx = clampedHour - HOUR_MIN;
  const roundedMin = (Math.round(sm / MIN_STEP) * MIN_STEP) % 60;
  const minIdx = roundedMin / MIN_STEP;

  const [eh, em] = parseTime(timeEnd);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const duration = Math.max(MIN_DURATION, endTotal - startTotal);

  // Emit a coherent {date, start, end} — callers update state in one go
  // so derived labels stay in sync and the grid reflows at once.
  const emit = (nextDate: string, nextStart: string, nextDuration: number) => {
    const [h, m] = parseTime(nextStart);
    const newEnd = minutesToHHMM(h * 60 + m + nextDuration);
    onChange({ date: nextDate, timeStart: nextStart, timeEnd: newEnd });
  };

  const handleDate = (idx: number) => {
    const k = dateKeys[idx];
    if (k && k !== date) emit(k, timeStart, duration);
  };

  const handleHour = (idx: number) => {
    const h = HOUR_MIN + idx;
    const nextStart = `${pad2(h)}:${pad2(roundedMin)}`;
    if (nextStart !== timeStart) emit(date, nextStart, duration);
  };

  const handleMin = (idx: number) => {
    const m = idx * MIN_STEP;
    const nextStart = `${pad2(clampedHour)}:${pad2(m)}`;
    if (nextStart !== timeStart) emit(date, nextStart, duration);
  };

  const bumpDuration = (delta: number) => {
    const next = Math.max(MIN_DURATION, duration + delta);
    if (next === duration) return;
    emit(date, timeStart, next);
  };

  const endLabel = minutesToHHMM(
    (HOUR_MIN + hourIdx) * 60 + minIdx * MIN_STEP + duration
  );

  return (
    <div className="mx-4 my-2 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* One-off rule to hide the scrollbar in WebKit — scrollbarWidth
          covers Firefox; this handles iOS/Safari. Browsers dedupe
          identical rules, so having it per picker is fine. */}
      <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>

      <div className="px-3 pt-3 pb-3 flex items-center justify-center gap-2">
        <WheelColumn
          items={dateLabels}
          selectedIndex={dateIdx}
          onChange={handleDate}
          width={110}
        />
        <WheelColumn
          items={hourLabels}
          selectedIndex={hourIdx}
          onChange={handleHour}
          width={44}
        />
        <div className="h-[108px] flex items-center text-lg font-bold text-slate-300 select-none">
          :
        </div>
        <WheelColumn
          items={minLabels}
          selectedIndex={minIdx}
          onChange={handleMin}
          width={44}
        />
      </div>
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => bumpDuration(-15)}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-[14px] font-bold active:bg-slate-200"
            aria-label="Уменьшить длительность"
          >
            −
          </button>
          <span className="text-sm font-bold w-10 text-center tabular-nums">
            {duration}м
          </span>
          <button
            type="button"
            onClick={() => bumpDuration(15)}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-[14px] font-bold active:bg-slate-200"
            aria-label="Увеличить длительность"
          >
            +
          </button>
        </div>
        <div className="text-[12px] text-slate-500 tabular-nums">
          до {endLabel}
        </div>
      </div>
    </div>
  );
}
