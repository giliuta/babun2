"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "@babun/shared/icons";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthName,
  isSameDay,
  getMonday,
  formatDateKey,
} from "@babun/shared/common/utils/date-utils";
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
  // Brief #6: tap year → grid of years (current ± 6) so the user can
  // jump multiple years in one click instead of pressing the chevron
  // 24 times. Closes when a year is picked.
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
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
        <button
          type="button"
          onClick={() => setYearPickerOpen((prev) => !prev)}
          aria-label="Выбрать год"
          aria-expanded={yearPickerOpen}
          className="text-[15px] font-semibold text-[var(--label)] capitalize tracking-tight px-2 py-0.5 rounded-md active:bg-[var(--fill-quaternary)] transition"
        >
          {getMonthName(viewMonth)} {viewYear}
        </button>
        <button
          onClick={nextMonth}
          aria-label="Следующий месяц"
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--fill-quaternary)] text-[var(--label-secondary)] transition"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      {yearPickerOpen ? (
        <div className="grid grid-cols-3 gap-1 mb-1">
          {Array.from({ length: 13 }, (_, i) => today.getFullYear() - 6 + i).map(
            (y) => {
              const active = y === viewYear;
              const isCurrent = y === today.getFullYear();
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setYearPickerOpen(false);
                  }}
                  className={`h-10 rounded-lg text-[13px] font-semibold transition active:bg-[var(--fill-quaternary)] ${
                    active
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : isCurrent
                      ? "text-[var(--accent)] border border-[var(--accent)]"
                      : "text-[var(--label)] bg-[var(--fill-tertiary)]"
                  }`}
                >
                  {y}
                </button>
              );
            },
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-0 mb-1">
            {dayHeaders.map((d) => (
              <div
                key={d}
                className="text-center text-[12px] font-semibold uppercase text-[var(--label-tertiary)] tracking-wider py-1"
              >
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
        </>
      )}

      {/* Brief #6: «Сегодня» button — jumps the view to the current
          month/year and selects today's Monday so the dispatcher
          doesn't have to chevron-back N months to «вернуться к
          сегодня». Disabled when already viewing today's month. */}
      <button
        type="button"
        onClick={() => {
          setViewYear(today.getFullYear());
          setViewMonth(today.getMonth());
          setYearPickerOpen(false);
          onSelectDate(getMonday(today));
          onClose();
        }}
        className="mt-2 w-full h-9 rounded-lg text-[13px] font-semibold text-[var(--accent)] bg-[var(--accent-tint)] active:opacity-80 transition"
      >
        Сегодня
      </button>
    </div>
  );
}
