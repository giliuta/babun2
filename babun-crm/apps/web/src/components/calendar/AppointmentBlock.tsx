"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Appointment, AppointmentColorKind } from "@/lib/appointments";
import { COLOR_KIND_TAILWIND, getDebtAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { DraftClient } from "@/components/appointments/AppointmentForm";
import type { Client } from "@/lib/clients";

interface AppointmentBlockProps {
  appointment: Appointment;
  colorKind: AppointmentColorKind;
  hourHeight?: number;
  clientsById: Record<string, Client | DraftClient>;
  services: Service[];
  onClick: (appointment: Appointment) => void;
  draggable?: boolean;
}

export default function AppointmentBlock({
  appointment,
  colorKind,
  hourHeight = 60,
  clientsById,
  services,
  onClick,
  draggable = false,
}: AppointmentBlockProps) {
  const colors = COLOR_KIND_TAILWIND[colorKind];

  const [startH, startM] = appointment.time_start.split(":").map(Number);
  const [endH, endM] = appointment.time_end.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const durationMinutes = Math.max(0, endMinutes - startMinutes);

  const pxPerMinute = hourHeight / 60;
  const topPx = startMinutes * pxPerMinute;
  const heightPx = Math.max(durationMinutes * pxPerMinute, 18);

  // dnd-kit draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `apt-${appointment.id}`,
    data: {
      appointmentId: appointment.id,
      durationMinutes,
    },
    disabled: !draggable,
  });

  let clientName = "";
  if (appointment.client_id && clientsById[appointment.client_id]) {
    clientName = clientsById[appointment.client_id].full_name;
  } else if (appointment.comment) {
    clientName = appointment.comment.split("\n")[0];
  }

  const aptServices = appointment.service_ids
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s));
  let serviceSummary = "";
  if (aptServices.length > 0) {
    serviceSummary =
      aptServices.length === 1
        ? aptServices[0].name
        : `${aptServices[0].name} +${aptServices.length - 1}`;
  }
  const serviceAccent = aptServices[0]?.color;

  const debt = getDebtAmount(appointment);
  const hasDebt = debt > 0 && appointment.status !== "scheduled";
  const isIncomplete = colorKind === "incomplete";
  const isCancelled = colorKind === "cancelled";
  const hasPhotos = appointment.photos.length > 0;

  return (
    <button
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        if (isDragging) return;
        onClick(appointment);
      }}
      {...listeners}
      {...attributes}
      className={`absolute left-0.5 right-0.5 lg:left-1 lg:right-1 ${colors.bg} ${colors.text} rounded-sm lg:rounded-md text-left overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-110 shadow-sm touch-none ${
        isDragging ? "opacity-70 z-30" : ""
      }`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        borderLeft: serviceAccent ? `3px solid ${serviceAccent}` : undefined,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : undefined,
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

        <div className="absolute bottom-0.5 right-1 flex gap-0.5 text-[10px] leading-none">
          {hasPhotos && <span>📷</span>}
          {hasDebt && <span>🟧</span>}
          {!hasDebt && isIncomplete && <span>⚠</span>}
        </div>
      </div>
    </button>
  );
}
