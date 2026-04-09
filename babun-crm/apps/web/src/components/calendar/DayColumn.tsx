"use client";

import {
  getDayNameShort,
  getMonthNameGenitive,
  isSameDay,
  formatDateKey,
} from "@/lib/date-utils";
import type { MockAppointment } from "@/lib/mock-data";
import AppointmentBlock from "./AppointmentBlock";
import { HOURS } from "./TimeGrid";

interface DayColumnProps {
  date: Date;
  today: Date;
  appointments: MockAppointment[];
  currentTimeMinutes: number; // minutes since midnight for current time line
  onAppointmentClick: (appointment: MockAppointment) => void;
}

export default function DayColumn({
  date,
  today,
  appointments,
  currentTimeMinutes,
  onAppointmentClick,
}: DayColumnProps) {
  const isToday = isSameDay(date, today);
  const dateKey = formatDateKey(date);
  const dayAppointments = appointments.filter((a) => a.date === dateKey);
  const dayName = getDayNameShort(date);
  const monthName = getMonthNameGenitive(date.getMonth());

  // Current time indicator position (relative to 08:00)
  const showTimeLine = isToday && currentTimeMinutes >= 480 && currentTimeMinutes <= 1320; // 08:00-22:00
  const timeLineTop = currentTimeMinutes - 480; // offset from 08:00

  return (
    <div className="flex-1 min-w-[120px] border-r border-gray-200 last:border-r-0">
      {/* Day header */}
      <div
        className={`h-[72px] border-b border-gray-200 px-2 py-2 text-center ${
          isToday ? "bg-green-50" : "bg-white"
        }`}
      >
        <div className="text-[10px] text-gray-400 uppercase">{monthName}</div>
        <div
          className={`text-xl font-bold leading-tight ${
            isToday ? "text-green-600" : "text-gray-900"
          }`}
        >
          {date.getDate()}
        </div>
        <div className="flex items-center justify-center gap-1">
          <span
            className={`text-xs font-medium ${
              isToday ? "text-green-600" : "text-gray-500"
            }`}
          >
            {dayName}
          </span>
          {dayAppointments.length > 0 && (
            <span className="text-[10px] text-gray-400">
              ({dayAppointments.length})
            </span>
          )}
        </div>
      </div>

      {/* Time slots */}
      <div className={`relative ${isToday ? "bg-green-50/30" : "bg-white"}`}>
        {/* Hour grid lines */}
        {HOURS.map((hour) => (
          <div key={hour} className="h-[60px] border-b border-gray-100" />
        ))}

        {/* Current time indicator */}
        {showTimeLine && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: `${timeLineTop}px` }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          </div>
        )}

        {/* Appointment blocks */}
        {dayAppointments.map((apt) => (
          <AppointmentBlock
            key={apt.id}
            appointment={apt}
            onClick={onAppointmentClick}
          />
        ))}
      </div>
    </div>
  );
}
