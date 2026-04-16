"use client";

import { useEffect, useMemo, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import { type TeamSchedule, DEFAULT_SCHEDULE } from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import type { ViewMode } from "@/components/layout/Header";
import { getCityColor } from "@/lib/day-cities";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: Appointment[];
  clientsById: Record<string, Client | DraftClient>;
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

  // Group consecutive days with the same city into runs.
  // E.g. Пафос×5, Лимассол×2 becomes two ribbon segments.
  // This turns the repeated "Пафос Пафос Пафос ..." into one
  // clean label per group.
  const cityRuns = useMemo(() => {
    const runs: { city: string; start: number; count: number; firstDateKey: string }[] = [];
    for (let i = 0; i < visibleDates.length; i++) {
      const key = visibleDates[i].toISOString().slice(0, 10);
      const city = cityForDate?.(key) ?? "";
      const last = runs[runs.length - 1];
      if (last && last.city === city) {
        last.count++;
      } else {
        runs.push({ city, start: i, count: 1, firstDateKey: key });
      }
    }
    return runs;
  }, [visibleDates, cityForDate]);

  const totalCols = visibleDates.length;

  return (
    <div className="flex flex-col w-full">
      {/* City ribbon — groups consecutive same-city days into one
          horizontal band instead of repeating "Пафос" in every
          column. Tap opens the city picker for the first day of
          the run (moves the whole group at once feels right —
          Dima плохо меняет город на один конкретный день, обычно
          всю неделю подряд). */}
      <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200 h-[22px] lg:h-[24px]">
        {cityRuns.map((run) => {
          const color = run.city ? getCityColor(run.city) : "#d4d4d8";
          const widthPct = (run.count / totalCols) * 100;
          return (
            <button
              key={`${run.start}-${run.city}`}
              type="button"
              onClick={() => run.city && onCityTap?.(run.firstDateKey)}
              className="relative flex items-center justify-center text-[10px] lg:text-[11px] font-semibold truncate px-2 active:opacity-70 border-r border-white last:border-r-0"
              style={{
                width: `${widthPct}%`,
                backgroundColor: run.city ? `${color}1f` : "#f8f8f9",
                color: run.city ? color : "#9ca3af",
              }}
            >
              <span className="truncate">
                {run.city || "— город не указан"}
              </span>
              {run.count > 1 && (
                <span className="ml-1 opacity-50 text-[9px] lg:text-[10px]">
                  · {run.count} дн
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex w-full">
        {visibleDates.map((date) => {
          const dateKey = date.toISOString().slice(0, 10);
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
            />
          );
        })}
      </div>
    </div>
  );
}
