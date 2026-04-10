"use client";

import type { MockAppointment } from "@/lib/mock-data";

const COLOR_MAP: Record<string, { bg: string; border: string }> = {
  blue: { bg: "bg-blue-500", border: "border-blue-600" },
  green: { bg: "bg-emerald-500", border: "border-emerald-600" },
  red: { bg: "bg-red-500", border: "border-red-600" },
  purple: { bg: "bg-purple-500", border: "border-purple-600" },
};

interface AppointmentBlockProps {
  appointment: MockAppointment;
  hourHeight?: number;
  onClick: (appointment: MockAppointment) => void;
}

export default function AppointmentBlock({
  appointment,
  hourHeight = 60,
  onClick,
}: AppointmentBlockProps) {
  const colors = COLOR_MAP[appointment.color] || COLOR_MAP.blue;

  // Calculate position: each hour = hourHeight px, starting from 08:00
  const [startH, startM] = appointment.time_start.split(":").map(Number);
  const [endH, endM] = appointment.time_end.split(":").map(Number);

  const startMinutes = (startH - 8) * 60 + startM;
  const endMinutes = (endH - 8) * 60 + endM;
  const durationMinutes = endMinutes - startMinutes;

  const pxPerMinute = hourHeight / 60;
  const topPx = startMinutes * pxPerMinute;
  const heightPx = Math.max(durationMinutes * pxPerMinute, 18); // Minimum 18px

  return (
    <button
      onClick={() => onClick(appointment)}
      className={`absolute left-0.5 right-0.5 lg:left-1 lg:right-1 ${colors.bg} rounded-sm lg:rounded-md text-white text-left overflow-hidden cursor-pointer hover:brightness-110 transition-all border-l-2 lg:border-l-[3px] ${colors.border} shadow-sm`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
      }}
    >
      <div className="px-1 lg:px-2 py-0.5 lg:py-1 h-full overflow-hidden">
        <div className="text-[8px] lg:text-[10px] font-medium opacity-90 leading-tight">
          {appointment.time_start}-{appointment.time_end}
        </div>
        {appointment.client_name && (
          <div className="text-[10px] lg:text-xs font-semibold truncate leading-tight">
            {appointment.client_name}
          </div>
        )}
        <div className="text-[8px] lg:text-[10px] truncate opacity-90 leading-tight">
          {appointment.service_name}
        </div>
        {heightPx > 60 && appointment.comment && (
          <div className="text-[8px] lg:text-[10px] truncate opacity-70 mt-0.5 leading-tight">
            {appointment.comment}
          </div>
        )}
      </div>
    </button>
  );
}
