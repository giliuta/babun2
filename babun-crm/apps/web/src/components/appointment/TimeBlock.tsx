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
}: TimeBlockProps) {
  const [expandedMode, setExpandedMode] = useState<"none" | "date" | "time">(
    "none"
  );
  const [weekOffset, setWeekOffset] = useState(0);

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
      <div className="px-4 py-3 bg-white border-b border-slate-100 text-[13px] text-slate-800 tabular-nums">
        {formatDateRu(date)} · {timeStart}–{timeEnd}
        {duration > 0 && <span className="text-slate-500 ml-1">· {duration} мин</span>}
      </div>
    );
  }

  const toggle = (mode: "date" | "time") =>
    setExpandedMode((prev) => (prev === mode ? "none" : mode));

  const headerRow = (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100 text-[13px]">
      <span className="flex-shrink-0 text-slate-400">
        <ClockIcon />
      </span>
      <button
        type="button"
        onClick={() => toggle("date")}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 transition active:scale-[0.98] ${
          expandedMode === "date"
            ? "bg-violet-50 text-violet-700"
            : "text-slate-900 active:bg-slate-50"
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
            ? "bg-violet-50 text-violet-700"
            : "text-slate-900 active:bg-slate-50"
        }`}
      >
        <span className="font-medium">
          {timeStart}–{timeEnd}
        </span>
        <ChevronDownIcon />
      </button>
      <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 tabular-nums">
        {duration} мин
      </span>
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
        className="border-b border-slate-100"
        style={{
          padding: "10px 10px 12px",
          background: "linear-gradient(180deg, #fafafa, #f5f3ff)",
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
                          ? "linear-gradient(180deg, #8b5cf6, #7c3aed)"
                          : "white",
                        border: active
                          ? "1px solid transparent"
                          : d.isToday
                          ? "1px solid rgb(167 139 250)"
                          : "1px solid rgb(226 232 240)",
                        color: active
                          ? "white"
                          : d.isToday
                          ? "rgb(124 58 237)"
                          : "rgb(15 23 42)",
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
                            ? "rgb(124 58 237)"
                            : "rgb(100 116 139)",
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
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "rgb(148 163 184)",
              }}
            >
              <span>{weekRangeLabel}</span>
            </div>
          </>
        )}

        {expandedMode === "time" && (
          <div className="flex items-center justify-center">
            <WheelGroup
              hourIdx={startHourIdx}
              minIdx={startMinIdx}
              onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
              onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
            />
            <span
              className="flex-shrink-0 text-slate-400 select-none"
              style={{ padding: "0 8px", lineHeight: `${WHEEL_H}px` }}
            >
              <ArrowRightIcon />
            </span>
            <WheelGroup
              hourIdx={endHourIdx}
              minIdx={endMinIdx}
              onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
              onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
            />
          </div>
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
        background: "white",
        border: "1px solid rgb(226 232 240)",
        color: "rgb(71 85 105)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
      aria-label={direction === "prev" ? "Предыдущая неделя" : "Следующая неделя"}
    >
      {direction === "prev" ? <ChevronLeftIcon size={14} /> : <ChevronRightIcon size={14} />}
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
