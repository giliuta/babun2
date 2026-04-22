"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime, formatDateKey } from "@/lib/date-utils";
import { type TeamSchedule, DEFAULT_SCHEDULE } from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { City } from "@/lib/cities";
import type { ViewMode } from "@/components/layout/Header";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: Appointment[];
  clientsById: Record<string, Client>;
  services: Service[];
  validateApt: (apt: Appointment) => ValidationResult;
  viewMode?: ViewMode;
  schedule?: TeamSchedule;
  cityForDate?: (dateKey: string) => string;
  onCityTap?: (dateKey: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onAppointmentLongPress?: (appointment: Appointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
  onFooterTap?: (dateKey: string) => void;
  onDayHeaderTap?: (dateKey: string) => void;
  extrasForDate?: (dateKey: string) => { income: number; expense: number };
  dragEnabled?: boolean;
  teamColorFor?: (apt: Appointment) => string | null;
  /** Sprint 033: settings.cities list so custom tags render in the
   *  user-picked colour instead of neutral grey. */
  cityLookup?: City[];
  /** Sprint 033: visible hour window (brigade calendar clipping). */
  windowStart?: number;
  windowEnd?: number;
}

export default function WeekView({
  mondayDate,
  appointments,
  clientsById,
  services,
  validateApt,
  viewMode = "week",
  schedule = DEFAULT_SCHEDULE,
  cityForDate,
  onCityTap,
  onAppointmentClick,
  onAppointmentLongPress,
  onEmptySlotClick,
  onFooterTap,
  onDayHeaderTap,
  extrasForDate,
  dragEnabled = false,
  teamColorFor,
  cityLookup,
  windowStart,
  windowEnd,
}: WeekViewProps) {
  const weekDates = getWeekDates(mondayDate);
  const [now, setNow] = useState(getCurrentCyprusTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(getCurrentCyprusTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  let visibleDates: Date[];
  if (viewMode === "day") {
    visibleDates = [weekDates[0]];
  } else if (viewMode === "3days") {
    visibleDates = weekDates.slice(0, 3);
  } else {
    visibleDates = weekDates;
  }

  // Sprint 033 Phase I4 — full-width now-line stretched across every
  // visible day. The per-column DayColumn still draws a red dot on
  // today's column so you can tell which day you're on, but the
  // horizontal stripe lives here so zooming doesn't leave a 2-px stub.
  const windowStartMin = Math.max(0, Math.min(24, windowStart ?? 0)) * 60;
  const windowEndMin =
    Math.max(windowStartMin / 60 + 1, Math.min(24, windowEnd ?? 24)) * 60;
  const todayIsVisible = visibleDates.some(
    (d) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate(),
  );
  const nowLineVisible =
    todayIsVisible &&
    currentTimeMinutes >= windowStartMin &&
    currentTimeMinutes <= windowEndMin;
  const nowLineTop = `calc(var(--hh) * ${(currentTimeMinutes - windowStartMin) / 60})`;

  // Offset below the day-header (height hardcoded in DayColumn:
  // h-[82px] lg:h-[82px]). We replicate it here so the line sits
  // relative to the grid, not the page top.
  const HEADER_PX = 72; // mobile; DayColumn header is 72-82 px
  return (
    <div className="relative flex w-full">
      {nowLineVisible && (
        <div
          className="absolute left-0 right-0 z-[15] pointer-events-none"
          style={{ top: `calc(${HEADER_PX}px + ${nowLineTop})` }}
        >
          <div className="h-[1.5px] bg-[var(--system-red)] opacity-80" />
        </div>
      )}
      {visibleDates.map((date) => {
        // Local YYYY-MM-DD — единый формат с DayColumn/page.tsx.
        // toISOString() converts to UTC and ломает ключ для GMT+2/+3
        // Cyprus (особенно до 3am когда UTC-сутки ещё не сменились).
        const dateKey = formatDateKey(date);
        return (
          <DayColumn
            key={date.toISOString()}
            date={date}
            today={now}
            appointments={appointments}
            clientsById={clientsById}
            services={services}
            validateApt={validateApt}
            currentTimeMinutes={currentTimeMinutes}
            schedule={schedule}
            cityLabel={cityForDate?.(dateKey) ?? ""}
            onCityTap={onCityTap}
            onAppointmentClick={onAppointmentClick}
            onAppointmentLongPress={onAppointmentLongPress}
            onEmptySlotClick={onEmptySlotClick}
            onFooterTap={onFooterTap}
            onDayHeaderTap={onDayHeaderTap}
            extraIncome={extrasForDate?.(dateKey).income ?? 0}
            extraExpense={extrasForDate?.(dateKey).expense ?? 0}
            dragEnabled={dragEnabled}
            teamColorFor={teamColorFor}
            cityLookup={cityLookup}
            windowStart={windowStart}
            windowEnd={windowEnd}
          />
        );
      })}
    </div>
  );
}
