"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import { type TeamSchedule, DEFAULT_SCHEDULE } from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import type { MockClient } from "@/lib/mock-data";
import type { DraftClient } from "@/components/appointments/AppointmentForm";
import type { ViewMode } from "@/components/layout/Header";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: Appointment[];
  clientsById: Record<string, MockClient | DraftClient>;
  validateApt: (apt: Appointment) => ValidationResult;
  viewMode?: ViewMode;
  hourHeight?: number;
  schedule?: TeamSchedule;
  onAppointmentClick: (appointment: Appointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
}

export default function WeekView({
  mondayDate,
  appointments,
  clientsById,
  validateApt,
  viewMode = "week",
  hourHeight = 60,
  schedule = DEFAULT_SCHEDULE,
  onAppointmentClick,
  onEmptySlotClick,
}: WeekViewProps) {
  const weekDates = getWeekDates(mondayDate);
  const [now, setNow] = useState(getCurrentCyprusTime());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(getCurrentCyprusTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Determine which dates to show based on view mode
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
      {visibleDates.map((date) => (
        <DayColumn
          key={date.toISOString()}
          date={date}
          today={now}
          appointments={appointments}
          clientsById={clientsById}
          validateApt={validateApt}
          currentTimeMinutes={currentTimeMinutes}
          hourHeight={hourHeight}
          schedule={schedule}
          onAppointmentClick={onAppointmentClick}
          onEmptySlotClick={onEmptySlotClick}
        />
      ))}
    </div>
  );
}
