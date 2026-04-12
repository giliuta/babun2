"use client";

import { memo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Appointment, AppointmentColorKind } from "@/lib/appointments";
import { COLOR_KIND_TAILWIND, getDebtAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { DraftClient } from "@/lib/draft-clients";
import type { Client } from "@/lib/clients";

interface AppointmentBlockProps {
  appointment: Appointment;
  colorKind: AppointmentColorKind;
  clientsById: Record<string, Client | DraftClient>;
  services: Service[];
  /** Team tint used to paint the left accent stripe. */
  teamColor?: string | null;
  onClick: (appointment: Appointment) => void;
  onLongPress?: (appointment: Appointment) => void;
  draggable?: boolean;
}

function AppointmentBlockInner({
  appointment,
  colorKind,
  clientsById,
  services,
  teamColor,
  onClick,
  onLongPress,
  draggable = false,
}: AppointmentBlockProps) {
  // Long-press detection — 550 ms hold without moving fires onLongPress and
  // suppresses the subsequent click. TouchSensor in dnd-kit uses a longer
  // delay so the two mechanisms no longer conflict.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const startLongPress = () => {
    longPressFired.current = false;
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress?.(appointment);
    }, 550);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const colors = COLOR_KIND_TAILWIND[colorKind];

  const [startH, startM] = appointment.time_start.split(":").map(Number);
  const [endH, endM] = appointment.time_end.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const durationMinutes = Math.max(0, endMinutes - startMinutes);

  // Positions are expressed in CSS `calc(var(--hh) * N)` so they follow the
  // live hour-height variable without triggering any React re-render during
  // pinch-zoom.
  const topExpr = `calc(var(--hh) * ${startMinutes / 60})`;
  const heightExpr = `max(calc(var(--hh) * ${durationMinutes / 60}), 18px)`;

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
  // Priority for the left accent stripe:
  //   1. per-appointment palette override
  //   2. team color (useful when viewing many teams at once)
  //   3. first service colour
  const accent =
    appointment.color_override ?? teamColor ?? aptServices[0]?.color ?? null;

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
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onClick(appointment);
      }}
      onPointerDown={startLongPress}
      onPointerMove={cancelLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.(appointment);
        longPressFired.current = true;
      }}
      {...listeners}
      {...attributes}
      className={`absolute left-0 right-0 ${
        appointment.color_override ? "" : `${colors.bg} ${colors.text}`
      } text-left overflow-hidden touch-none will-change-transform ${
        isDragging ? "opacity-70 z-30" : ""
      }`}
      style={{
        top: topExpr,
        height: heightExpr,
        backgroundColor: appointment.color_override ?? undefined,
        borderLeft: `3px solid ${accent || "rgba(0,0,0,0.25)"}`,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : undefined,
        contain: "layout paint",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div className="px-1.5 py-0.5 h-full overflow-hidden relative">
        <div
          className={`text-[8px] lg:text-[10px] font-medium opacity-90 leading-tight ${
            isCancelled ? "line-through" : ""
          }`}
        >
          {appointment.time_start}-{appointment.time_end}
        </div>
        {clientName && (
          <div
            className={`text-[10px] lg:text-xs font-semibold truncate leading-tight ${
              isCancelled ? "line-through opacity-80" : ""
            }`}
          >
            {clientName}
          </div>
        )}
        {serviceSummary && (
          <div className="text-[8px] lg:text-[10px] truncate opacity-90 leading-tight">
            {serviceSummary}
          </div>
        )}
        {appointment.comment && (
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

const AppointmentBlock = memo(AppointmentBlockInner);
export default AppointmentBlock;
