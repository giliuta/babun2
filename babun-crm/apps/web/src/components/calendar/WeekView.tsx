"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import { type TeamSchedule, DEFAULT_SCHEDULE } from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import type { ViewMode } from "@/components/layout/Header";
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

  return (
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
          />
        );
      })}
    </div>
  );
}
