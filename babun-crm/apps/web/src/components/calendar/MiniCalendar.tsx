"use client";

import { useState, useEffect, useRef } from "react";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthName,
  isSameDay,
  getMonday,
  formatDateKey,
} from "@/lib/date-utils";
interface MiniCalendarAppointment {
  date: string;
}

interface MiniCalendarProps {
  currentDate: Date;
  appointments: MiniCalendarAppointment[];
  onSelectDate: (monday: Date) => void;
  onClose: () => void;
}

export default function MiniCalendar({
  currentDate,
  appointments,
  onSelectDate,
  onClose,
}: MiniCalendarProps) {
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  // Convert Sunday=0 to Monday-first: Mon=0 ... Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Build appointment count map for this month
  const aptCountMap: Record<string, number> = {};
  for (const apt of appointments) {
    aptCountMap[apt.date] = (aptCountMap[apt.date] || 0) + 1;
  }

  const handleDayClick = (day: number) => {
    const selected = new Date(viewYear, viewMonth, day);
    const monday = getMonday(selected);
    onSelectDate(monday);
    onClose();
  };

  const dayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50 w-[280px]"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {getMonthName(viewMonth)} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(viewYear, viewMonth, day);
          const isToday = isSameDay(date, today);
          const dateKey = formatDateKey(date);
          const aptCount = aptCountMap[dateKey] || 0;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={`h-9 flex flex-col items-center justify-center rounded-lg text-xs relative hover:bg-gray-100 transition-colors ${
                isToday
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "text-gray-700"
              }`}
            >
              <span className="leading-none">{day}</span>
              {aptCount > 0 && (
                <span
                  className={`text-[8px] leading-none mt-0.5 ${
                    isToday ? "text-indigo-200" : "text-indigo-500"
                  }`}
                >
                  {aptCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
