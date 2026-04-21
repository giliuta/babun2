"use client";

import { memo, useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onDayClick: (date: Date) => void;
}

const DAYS_OF_WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MonthViewInner({
  currentDate,
  appointments,
  onDayClick,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);

  // Build a 6-row × 7-col grid starting from the Monday of the week
  // that contains the 1st of the month.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const firstDow = (firstOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6
    const start = new Date(year, month, 1 - firstDow);

    const grid: Date[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return grid;
  }, [year, month]);

  // Group appointments by date for quick lookup.
  const byDate = useMemo(() => {
    const map: Record<string, { count: number; income: number }> = {};
    for (const apt of appointments) {
      if (!map[apt.date]) map[apt.date] = { count: 0, income: 0 };
      map[apt.date].count += 1;
      if (apt.status === "completed" || apt.status === "in_progress") {
        map[apt.date].income += getPaidAmount(apt);
      }
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--surface-card)] min-h-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--separator)] bg-[var(--surface-grouped)] flex-shrink-0">
        {DAYS_OF_WEEK.map((dow, i) => (
          <div
            key={dow}
            className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wider ${
              i >= 5 ? "text-[var(--system-red)]/60" : "text-[var(--label-secondary)]"
            }`}
          >
            {dow}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {cells.map((date, i) => {
          const key = formatDateKey(date);
          const data = byDate[key];
          const inCurrentMonth = date.getMonth() === month;
          const isToday = key === todayKey;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(date)}
              className={`border-r border-b border-[var(--separator)] p-1 text-left flex flex-col items-start active:bg-[var(--accent-tint)] overflow-hidden transition-colors ${
                inCurrentMonth ? "bg-[var(--surface-card)]" : "bg-[var(--surface-grouped)]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-[12px] font-bold">
                    {date.getDate()}
                  </span>
                ) : (
                  <span
                    className={`text-[13px] font-semibold ${
                      inCurrentMonth
                        ? isWeekend
                          ? "text-[var(--system-red)]"
                          : "text-[var(--label)]"
                        : "text-[var(--label-tertiary)]"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                )}
                {data && data.count > 0 && (
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-tint)] rounded-full px-1.5 leading-[16px]">
                    {data.count}
                  </span>
                )}
              </div>
              {data && data.income > 0 && (
                <div className="text-[10px] text-[var(--system-green)] font-semibold mt-0.5 tabular-nums truncate w-full">
                  {data.income}€
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MonthView = memo(MonthViewInner);
export default MonthView;
