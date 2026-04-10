"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import type { MockAppointment } from "@/lib/mock-data";
import type { ViewMode } from "@/components/layout/Header";
import TimeGrid from "./TimeGrid";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: MockAppointment[];
  viewMode?: ViewMode;
  hourHeight?: number;
  onAppointmentClick: (appointment: MockAppointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
}

export default function WeekView({
  mondayDate,
  appointments,
  viewMode = "week",
  hourHeight = 60,
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
    <div className="flex-1 overflow-auto bg-white">
      <div className="flex h-full">
        {/* Time column */}
        <TimeGrid hourHeight={hourHeight} />

        {/* Day columns */}
        {visibleDates.map((date) => (
          <DayColumn
            key={date.toISOString()}
            date={date}
            today={now}
            appointments={appointments}
            currentTimeMinutes={currentTimeMinutes}
            hourHeight={hourHeight}
            onAppointmentClick={onAppointmentClick}
            onEmptySlotClick={onEmptySlotClick}
          />
        ))}
      </div>
    </div>
  );
}
