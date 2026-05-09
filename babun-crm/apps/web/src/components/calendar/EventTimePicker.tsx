"use client";

// STORY-056 — Bottom-sheet picker for date + start time + end time
// for the unified EventSheet. Wraps existing WheelPicker (iOS-style
// scroll-snap wheel) so the look matches the rest of the app.
//
// Single sheet, three-section body:
//   1. Date wheels (day · month · year)
//   2. Start time wheels (hour : minute, 5-min step)
//   3. End time wheels (hour : minute, 5-min step), auto-adjusts to
//      stay >= start; the user can override by scrolling down.
//
// All-day mode is a separate toggle on the EventSheet (not in this
// picker), so when allDay=true the picker is closed by the parent.

import { useEffect, useMemo, useState } from "react";
import SheetShell from "@/components/ui/SheetShell";
import WheelPicker from "@/components/appointments/sheet/WheelPicker";

interface EventTimePickerProps {
  open: boolean;
  onClose: () => void;
  value: { date: string; timeStart: string; timeEnd: string };
  onConfirm: (next: { date: string; timeStart: string; timeEnd: string }) => void;
}

const MONTHS_RU = [
  "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
  "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function daysInMonth(year: number, monthZero: number): number {
  return new Date(year, monthZero + 1, 0).getDate();
}

function parseDate(s: string): { day: number; month: number; year: number } {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) {
    const n = new Date();
    return { day: n.getDate(), month: n.getMonth(), year: n.getFullYear() };
  }
  return { day: d, month: m - 1, year: y };
}

function formatDate(day: number, month: number, year: number): string {
  const max = daysInMonth(year, month);
  const d = Math.min(day, max);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseTime(s: string): { h: number; mIndex: number } {
  const [hh, mm] = s.split(":").map(Number);
  const safeHour = Number.isNaN(hh) ? 9 : Math.max(0, Math.min(23, hh));
  const safeMin = Number.isNaN(mm) ? 0 : Math.max(0, Math.min(55, mm));
  // Snap to nearest 5-min step in MINUTES list.
  const mIdx = Math.round(safeMin / 5);
  return { h: safeHour, mIndex: Math.min(11, mIdx) };
}

function formatTime(h: number, mIndex: number): string {
  return `${String(h).padStart(2, "0")}:${MINUTES[mIndex]}`;
}

export default function EventTimePicker({
  open,
  onClose,
  value,
  onConfirm,
}: EventTimePickerProps) {
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startHour, setStartHour] = useState(9);
  const [startMinIdx, setStartMinIdx] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinIdx, setEndMinIdx] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    const d = parseDate(value.date);
    setDay(d.day);
    setMonth(d.month);
    setYear(d.year);
    const ts = parseTime(value.timeStart);
    setStartHour(ts.h);
    setStartMinIdx(ts.mIndex);
    const te = parseTime(value.timeEnd);
    setEndHour(te.h);
    setEndMinIdx(te.mIndex);
  }, [open, value.date, value.timeStart, value.timeEnd]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear - 2 + i),
    [currentYear],
  );
  const maxDay = daysInMonth(year, month);
  const dayValues = useMemo(
    () => Array.from({ length: 31 }, (_, i) => i + 1),
    [],
  );

  const startTotal = startHour * 60 + Number(MINUTES[startMinIdx]);
  const endTotal = endHour * 60 + Number(MINUTES[endMinIdx]);
  const endsBeforeStart = endTotal <= startTotal;

  const handleConfirm = () => {
    const date = formatDate(day, month, year);
    const ts = formatTime(startHour, startMinIdx);
    // Auto-bump end by 30 min if it's invalid.
    let te = formatTime(endHour, endMinIdx);
    if (endsBeforeStart) {
      const bumped = Math.min(23 * 60 + 59, startTotal + 30);
      te = `${String(Math.floor(bumped / 60)).padStart(2, "0")}:${String(bumped % 60).padStart(2, "0")}`;
    }
    onConfirm({ date, timeStart: ts, timeEnd: te });
    onClose();
  };

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="Время"
      height="auto"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] transition"
        >
          Готово
        </button>
      }
    >
      <div className="bg-[var(--surface-card)] divide-y divide-[var(--separator)]">
        {/* Date row */}
        <div className="px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1 px-1">
            Дата
          </div>
          <div className="flex items-stretch gap-1">
            <WheelPicker
              values={dayValues}
              selectedIndex={Math.min(day, maxDay) - 1}
              onChange={(i) => setDay(i + 1)}
              className="flex-[0.8]"
            />
            <WheelPicker
              values={MONTHS_RU}
              selectedIndex={month}
              onChange={(i) => setMonth(i)}
              className="flex-[1.4]"
            />
            <WheelPicker
              values={years}
              selectedIndex={Math.max(0, years.indexOf(year))}
              onChange={(i) => setYear(years[i])}
              className="flex-[1]"
            />
          </div>
        </div>

        {/* Start time row */}
        <div className="px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1 px-1">
            Начало
          </div>
          <div className="flex items-stretch gap-1 justify-center">
            <WheelPicker
              values={HOURS}
              selectedIndex={startHour}
              onChange={setStartHour}
              className="flex-[1]"
            />
            <WheelPicker
              values={MINUTES}
              selectedIndex={startMinIdx}
              onChange={setStartMinIdx}
              className="flex-[1]"
            />
          </div>
        </div>

        {/* End time row */}
        <div className="px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1 px-1 flex items-center justify-between">
            <span>Окончание</span>
            {endsBeforeStart && (
              <span className="text-[var(--system-orange)] normal-case tracking-normal">
                автокоррекция при сохранении
              </span>
            )}
          </div>
          <div className="flex items-stretch gap-1 justify-center">
            <WheelPicker
              values={HOURS}
              selectedIndex={endHour}
              onChange={setEndHour}
              className="flex-[1]"
            />
            <WheelPicker
              values={MINUTES}
              selectedIndex={endMinIdx}
              onChange={setEndMinIdx}
              className="flex-[1]"
            />
          </div>
        </div>
      </div>
    </SheetShell>
  );
}
