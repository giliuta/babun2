"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      className="absolute top-full left-0 mt-2 bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] border border-[var(--separator)] p-3 z-50 w-[288px]"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--fill-quaternary)] text-[var(--label-secondary)] transition"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <span className="text-[15px] font-semibold text-[var(--label)] capitalize tracking-tight">
          {getMonthName(viewMonth)} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Следующий месяц"
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--fill-quaternary)] text-[var(--label-secondary)] transition"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase text-[var(--label-tertiary)] tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}

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
              className={`h-9 flex flex-col items-center justify-center rounded-full text-[14px] relative active:bg-[var(--fill-quaternary)] transition-colors ${
                isToday
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)] font-semibold"
                  : "text-[var(--label)]"
              }`}
            >
              <span className="leading-none">{day}</span>
              {aptCount > 0 && (
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 ${
                    isToday ? "bg-white/80" : "bg-[var(--accent)]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
