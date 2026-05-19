"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime, formatDateKey } from "@babun/shared/common/utils/date-utils";
import { type TeamSchedule, DEFAULT_SCHEDULE } from "@babun/shared/local/schedule";
import type { Appointment, ValidationResult } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import type { Client } from "@babun/shared/local/clients";
import type { City } from "@babun/shared/local/cities";
import type { ViewMode } from "@/components/layout/Header";
import { useCalendarSettings } from "@/components/layout/DashboardClientLayout";
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
  /** STORY-092 — drag-resize bottom edge. Forwarded to DayColumn. */
  onAppointmentResize?: (appointment: Appointment, newEndHHMM: string) => void;
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
  /** v443 — work-hour band. Hours outside [workStart, workEnd] get a
   *  light grey wash so the user can see at a glance when their
   *  active period is. */
  workStart?: number;
  workEnd?: number;
  /** Phase I36 — snap granularity for empty-cell taps, minutes. Also
   *  the default duration of appointments created this way. 15/30/60. */
  snapMinutes?: number;
  /** Phase I38 — whether the brigade has any labels configured. When
   *  false, day headers skip the per-day label chip entirely. */
  hasLabels?: boolean;
  /** Phase I39 — effective «behaviour» resolved by the parent. */
  hideCancelled?: boolean;
  bufferMinutes?: number;
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
  onAppointmentResize,
  onEmptySlotClick,
  onFooterTap,
  onDayHeaderTap,
  extrasForDate,
  dragEnabled = false,
  teamColorFor,
  cityLookup,
  windowStart,
  windowEnd,
  workStart,
  workEnd,
  snapMinutes,
  hasLabels,
  hideCancelled,
  bufferMinutes,
}: WeekViewProps) {
  const weekDates = getWeekDates(mondayDate);
  const [now, setNow] = useState(getCurrentCyprusTime());
  // STORY-060 F2.5 — day-off weekday set comes from calendar settings.
  const { calendarSettings } = useCalendarSettings();
  const daysOff = calendarSettings.days_off;

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

  // Sprint 033 Phase I22 — now-line scoped to TODAY'S column only.
  // Previous full-width stripe (I4) made the current time blur across
  // the entire week grid — confusing when Monday's events look like
  // they're at "now". A per-day stripe scoped to today keeps the
  // semantics ("this is now on this day") without polluting other
  // columns. We keep the stripe rendered at the WeekView level
  // (not DayColumn) so it's decoupled from --hh pinch-zoom rounding.
  const windowStartMin = Math.max(0, Math.min(24, windowStart ?? 0)) * 60;
  const windowEndMin =
    Math.max(windowStartMin / 60 + 1, Math.min(24, windowEnd ?? 24)) * 60;
  const todayIdx = visibleDates.findIndex(
    (d) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate(),
  );
  const nowLineVisible =
    todayIdx >= 0 &&
    currentTimeMinutes >= windowStartMin &&
    currentTimeMinutes <= windowEndMin;
  const nowLineTop = `calc(var(--hh) * ${(currentTimeMinutes - windowStartMin) / 60})`;
  const colPct = visibleDates.length > 0 ? 100 / visibleDates.length : 0;

  // Offset below the day-header (height hardcoded in DayColumn:
  // h-[82px] lg:h-[82px]). We replicate it here so the line sits
  // relative to the grid, not the page top.
  const HEADER_PX = 72; // mobile; DayColumn header is 72-82 px

  // v477 — week-level off-hours wash removed. It used CalendarSettings,
  // while DayColumn paints its own wash from the day's TeamSchedule, so
  // the two stacked into a double-shaded strip (user: «подсвечивает
  // старую настройку»). DayColumn now reads from the same calendar
  // settings (via activeSchedule) on the personal tab, so a single
  // wash per column is enough — and it correctly tracks per-day
  // schedules on brigade tabs.
  void workStart;
  void workEnd;
  return (
    <div className="relative flex w-full">
      {nowLineVisible && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{
            top: `calc(${HEADER_PX}px + ${nowLineTop})`,
            left: `${todayIdx * colPct}%`,
            width: `${colPct}%`,
          }}
        >
          {/* Red dot anchor + stripe covering today's column only. */}
          <div className="relative h-[1.5px] bg-[var(--system-red)] opacity-85">
            <div className="absolute -left-[3px] -top-[3px] w-[7px] h-[7px] rounded-full bg-[var(--system-red)]" />
          </div>
        </div>
      )}
      {visibleDates.map((date, idx) => {
        // Local YYYY-MM-DD — единый формат с DayColumn/page.tsx.
        // toISOString() converts to UTC and ломает ключ для GMT+2/+3
        // Cyprus (особенно до 3am когда UTC-сутки ещё не сменились).
        const dateKey = formatDateKey(date);
        const isDayOff = daysOff.includes(date.getDay());
        // STORY-060 F3.1 — only the leftmost day shows the year next
        // to the month. All other columns keep the compact "ВТ 12 май"
        // form so the header strip doesn't read like a price tag.
        const isFirstVisible = idx === 0;
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
            onAppointmentResize={onAppointmentResize}
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
            snapMinutes={snapMinutes}
            hasLabels={hasLabels}
            hideCancelled={hideCancelled}
            bufferMinutes={bufferMinutes}
            isDayOff={isDayOff}
            isFirstVisible={isFirstVisible}
          />
        );
      })}
    </div>
  );
}
