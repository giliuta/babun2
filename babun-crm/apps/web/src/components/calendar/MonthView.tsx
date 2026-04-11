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
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      {/* Days-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-300 bg-gray-50 flex-shrink-0">
        {DAYS_OF_WEEK.map((dow, i) => (
          <div
            key={dow}
            className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wide ${
              i >= 5 ? "text-red-400" : "text-gray-500"
            }`}
          >
            {dow}
          </div>
        ))}
      </div>

      {/* 6 × 7 grid */}
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
              className={`border-r border-b border-gray-100 p-1 text-left flex flex-col items-start active:bg-indigo-50 overflow-hidden ${
                inCurrentMonth ? "bg-white" : "bg-gray-50/60"
              } ${isWeekend && inCurrentMonth ? "bg-red-50/20" : ""}`}
            >
              <div className="flex items-center justify-between w-full">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-[12px] font-bold">
                    {date.getDate()}
                  </span>
                ) : (
                  <span
                    className={`text-[12px] font-semibold ${
                      inCurrentMonth
                        ? isWeekend
                          ? "text-red-500"
                          : "text-gray-800"
                        : "text-gray-400"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                )}
                {data && data.count > 0 && (
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 rounded-full px-1.5 leading-[14px]">
                    {data.count}
                  </span>
                )}
              </div>
              {data && data.income > 0 && (
                <div className="text-[9px] text-emerald-600 font-semibold mt-0.5 tabular-nums truncate w-full">
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
