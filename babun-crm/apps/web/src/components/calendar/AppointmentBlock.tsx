"use client";

import type { Appointment, AppointmentColorKind } from "@/lib/appointments";
import { COLOR_KIND_TAILWIND, getDebtAmount } from "@/lib/appointments";
import { MOCK_SERVICES } from "@/lib/mock-data";
import type { DraftClient } from "@/components/appointments/AppointmentForm";
import type { MockClient } from "@/lib/mock-data";

interface AppointmentBlockProps {
  appointment: Appointment;
  colorKind: AppointmentColorKind;
  hourHeight?: number;
  clientsById: Record<string, MockClient | DraftClient>;
  onClick: (appointment: Appointment) => void;
}

export default function AppointmentBlock({
  appointment,
  colorKind,
  hourHeight = 60,
  clientsById,
  onClick,
}: AppointmentBlockProps) {
  const colors = COLOR_KIND_TAILWIND[colorKind];

  // Calculate position: each hour = hourHeight px, starting from 00:00
  const [startH, startM] = appointment.time_start.split(":").map(Number);
  const [endH, endM] = appointment.time_end.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const durationMinutes = Math.max(0, endMinutes - startMinutes);

  const pxPerMinute = hourHeight / 60;
  const topPx = startMinutes * pxPerMinute;
  const heightPx = Math.max(durationMinutes * pxPerMinute, 18);

  // Resolve client name
  let clientName = "";
  if (appointment.client_id && clientsById[appointment.client_id]) {
    clientName = clientsById[appointment.client_id].full_name;
  } else if (appointment.comment) {
    // Fall back to the first line of the comment (migrated mock data embeds the name here)
    clientName = appointment.comment.split("\n")[0];
  }

  // Service summary
  const services = appointment.service_ids
    .map((id) => MOCK_SERVICES.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  let serviceSummary = "";
  if (services.length > 0) {
    serviceSummary =
      services.length === 1
        ? services[0].name
        : `${services[0].name} +${services.length - 1}`;
  }

  const debt = getDebtAmount(appointment);
  const hasDebt = debt > 0 && appointment.status !== "scheduled";
  const isIncomplete = colorKind === "incomplete";
  const isCancelled = colorKind === "cancelled";

  return (
    <button
      onClick={() => onClick(appointment)}
      className={`absolute left-0.5 right-0.5 lg:left-1 lg:right-1 ${colors.bg} ${colors.text} rounded-sm lg:rounded-md text-left overflow-hidden cursor-pointer hover:brightness-110 transition-all border-l-2 lg:border-l-[3px] ${colors.border} shadow-sm`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
      }}
    >
      <div className="px-1 lg:px-2 py-0.5 lg:py-1 h-full overflow-hidden relative">
        <div
          className={`text-[8px] lg:text-[10px] font-medium opacity-90 leading-tight ${
            isCancelled ? "line-through" : ""
          }`}
        >
          {appointment.time_start}-{appointment.time_end}
        </div>
        {clientName && (
          <div className="text-[10px] lg:text-xs font-semibold truncate leading-tight">
            {clientName}
          </div>
        )}
        {serviceSummary && (
          <div className="text-[8px] lg:text-[10px] truncate opacity-90 leading-tight">
            {serviceSummary}
          </div>
        )}
        {heightPx > 60 && appointment.comment && (
          <div className="text-[8px] lg:text-[10px] truncate opacity-70 mt-0.5 leading-tight">
            {appointment.comment}
          </div>
        )}

        {/* Status badges — bottom right */}
        {(hasDebt || isIncomplete) && (
          <div className="absolute bottom-0.5 right-1 text-[10px] leading-none">
            {hasDebt ? "🟧" : "⚠"}
          </div>
        )}
      </div>
    </button>
  );
}
