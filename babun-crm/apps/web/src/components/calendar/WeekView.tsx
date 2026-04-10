"use client";

import { useEffect, useRef, useState } from "react";
import { getWeekDates, getCurrentCyprusTime } from "@/lib/date-utils";
import { timeToMinutes, type TeamSchedule, DEFAULT_SCHEDULE } from "@/lib/schedule";
import type { MockAppointment } from "@/lib/mock-data";
import type { ViewMode } from "@/components/layout/Header";
import TimeGrid from "./TimeGrid";
import DayColumn from "./DayColumn";

interface WeekViewProps {
  mondayDate: Date;
  appointments: MockAppointment[];
  viewMode?: ViewMode;
  hourHeight?: number;
  schedule?: TeamSchedule;
  /** When true, scrolls vertically to the team's work-start hour after mount/update. */
  autoScrollKey?: string;
  onAppointmentClick: (appointment: MockAppointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
}

export default function WeekView({
  mondayDate,
  appointments,
  viewMode = "week",
  hourHeight = 60,
  schedule = DEFAULT_SCHEDULE,
  autoScrollKey,
  onAppointmentClick,
  onEmptySlotClick,
}: WeekViewProps) {
  const weekDates = getWeekDates(mondayDate);
  const [now, setNow] = useState(getCurrentCyprusTime());
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(getCurrentCyprusTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Auto-scroll to the team's work-start hour when schedule/key changes
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const startMin = timeToMinutes(schedule.start);
    // Scroll so the work-start hour is at the top of the visible area
    const headerHeight = 0; // header is sticky-less; account 0
    const target = Math.max(0, startMin * (hourHeight / 60) - headerHeight);
    el.scrollTo({ top: target, behavior: "auto" });
  }, [schedule.start, hourHeight, autoScrollKey]);

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
    <div
      ref={scrollerRef}
      className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden bg-white"
    >
      <div className="flex min-h-full w-full">
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
            schedule={schedule}
            onAppointmentClick={onAppointmentClick}
            onEmptySlotClick={onEmptySlotClick}
          />
        ))}
      </div>
    </div>
  );
}
