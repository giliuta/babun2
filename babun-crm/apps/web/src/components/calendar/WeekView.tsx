"use client";

import { useEffect, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import type { MockAppointment } from "@/lib/mock-data";
import TimeGrid from "./TimeGrid";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: MockAppointment[];
  onAppointmentClick: (appointment: MockAppointment) => void;
}

export default function WeekView({
  mondayDate,
  appointments,
  onAppointmentClick,
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

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="flex min-w-[900px]">
        {/* Time column */}
        <TimeGrid />

        {/* Day columns */}
        {weekDates.map((date) => (
          <DayColumn
            key={date.toISOString()}
            date={date}
            today={now}
            appointments={appointments}
            currentTimeMinutes={currentTimeMinutes}
            onAppointmentClick={onAppointmentClick}
          />
        ))}
      </div>
    </div>
  );
}
