"use client";

import { memo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Camera, Check, Clock } from "lucide-react";
import type { Appointment, AppointmentColorKind } from "@/lib/appointments";
import { COLOR_KIND_TAILWIND, getDebtAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Client } from "@/lib/clients";

interface AppointmentBlockProps {
  appointment: Appointment;
  colorKind: AppointmentColorKind;
  clientsById: Record<string, Client>;
  services: Service[];
  /** Team tint used to paint the left accent stripe. */
  teamColor?: string | null;
  /** Override left/width for side-by-side overlap display. */
  overlapStyle?: { left: string; width: string };
  /** Sprint 033: brigade calendar window — minutes from midnight that
   *  correspond to the top pixel of the parent column. Needed so the
   *  block's top expression maps to the right hour even when the grid
   *  starts at 06:00 instead of 00:00. Default 0 = full-day grid. */
  windowStartMin?: number;
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
  overlapStyle,
  windowStartMin = 0,
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
  // Offset the top so appointments in a windowed grid (e.g. brigade
  // shows only 06:00–23:30) sit at the right hour. windowStartMin = 0
  // for the default full-day grid, which makes this a no-op.
  const topExpr = `calc(var(--hh) * ${(startMinutes - windowStartMin) / 60})`;
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
      className={`absolute ${overlapStyle ? "" : "left-0 right-0"} ${
        appointment.color_override ? "" : `${colors.bg} ${colors.text}`
      } text-left overflow-hidden touch-none will-change-transform ${
        isDragging ? "opacity-70 z-30" : ""
      }`}
      style={{
        top: topExpr,
        height: heightExpr,
        ...(overlapStyle ?? {}),
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
        {/* Line 1: time range */}
        <div
          className={`text-[8px] lg:text-[12px] font-medium opacity-80 leading-tight ${
            isCancelled ? "line-through" : ""
          }`}
        >
          {appointment.time_start}-{appointment.time_end}
        </div>

        {/* Line 2: client name + AC count */}
        {clientName && (
          <div
            className={`text-[12px] lg:text-xs font-bold truncate leading-tight ${
              isCancelled ? "line-through opacity-80" : ""
            }`}
          >
            {clientName}
            {appointment.service_ids.length > 0 && (
              <span className="font-normal opacity-80"> · {appointment.service_ids.length > 1 ? `${appointment.service_ids.length} усл.` : ""}</span>
            )}
          </div>
        )}

        {/* Line 3: service or comment — useful context for the team */}
        {serviceSummary && (
          <div className="text-[8px] lg:text-[12px] truncate opacity-80 leading-tight">
            {serviceSummary}
          </div>
        )}

        <div className="absolute bottom-0.5 right-1 flex gap-0.5 leading-none">
          {!appointment.address && colorKind === "no_address" && (
            <AlertTriangle size={10} strokeWidth={2.5} className="text-[var(--system-red)]" />
          )}
          {hasPhotos && (
            <Camera size={10} strokeWidth={2} className="opacity-80" />
          )}
        </div>

        <StatusBadge appointment={appointment} />
      </div>
    </button>
  );
}

// Status badge on the top-right of every appointment block. Completed
// → emerald check, scheduled-but-past-end → amber clock. Others render
// nothing — the block's fill already carries status info.
function StatusBadge({ appointment }: { appointment: Appointment }) {
  const { status, date, time_end } = appointment;
  if (status === "completed") {
    return (
      <div className="absolute top-0.5 right-1 w-3.5 h-3.5 rounded-full bg-[var(--system-green)] flex items-center justify-center">
        <Check size={9} strokeWidth={3.5} className="text-[var(--label-on-accent)]" />
      </div>
    );
  }
  if (status === "scheduled") {
    const end = new Date(`${date}T${time_end}:00`);
    if (end.getTime() < Date.now()) {
      return (
        <div className="absolute top-0.5 right-1 w-3.5 h-3.5 rounded-full bg-[var(--system-orange)] flex items-center justify-center">
          <Clock size={9} strokeWidth={2.5} className="text-[var(--label-on-accent)]" />
        </div>
      );
    }
  }
  return null;
}

const AppointmentBlock = memo(AppointmentBlockInner);
export default AppointmentBlock;
