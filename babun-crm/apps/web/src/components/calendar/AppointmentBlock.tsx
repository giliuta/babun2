"use client";

import { memo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Camera, Check, Clock } from "@babun/shared/icons";
import type { Appointment, AppointmentColorKind } from "@babun/shared/local/appointments";
import { COLOR_KIND_TAILWIND, getDebtAmount } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import type { Client } from "@babun/shared/local/clients";

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
  /** Sprint 033 Phase I35 — past appointments render at 50% opacity
   *  so the dispatcher visually separates history from upcoming. */
  dimmed?: boolean;
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
  dimmed = false,
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
  // STORY-049 — photos no longer ride on the appointment row; the
  // calendar grid doesn't fetch them per-block. The hasPhotos
  // indicator returns when STORY-049b adds a join-count or when we
  // surface a per-tenant photo summary.
  const hasPhotos = false;

  return (
    <button
      ref={setNodeRef}
      data-appointment-id={appointment.id}
      data-testid={`appointment-block-${appointment.id}`}
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
      } text-left overflow-hidden touch-none will-change-transform rounded-[6px] ${
        isDragging ? "opacity-70 z-30" : dimmed ? "opacity-50" : ""
      }`}
      style={{
        top: topExpr,
        height: heightExpr,
        ...(overlapStyle ?? {}),
        backgroundColor: appointment.color_override ?? undefined,
        // v498 — left-accent kept (3px solid in the event color) but
        // we also stamp a thin white hairline outline around the whole
        // card + a soft drop-shadow. The triple cue (radius + outline
        // + shadow) reads as a distinct iOS-style card even when 3
        // events stack side-by-side at ~40 px width. Subtle enough
        // that a single non-overlapping event still looks calm.
        borderLeft: `3px solid ${accent || "rgba(0,0,0,0.25)"}`,
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.08)",
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : undefined,
        contain: "layout paint",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div className="px-1.5 py-1 h-full overflow-hidden relative flex flex-col gap-[1px]">
        {/* Line 1: time range — compact, always shown.
            STORY audit (design-keeper): bumped 10→11 (mobile) / 11→12
            (lg) to clear the typography floor. tabular-nums keeps the
            digit grid tight. */}
        <div
          className={`text-[11px] lg:text-[12px] font-semibold opacity-85 leading-tight tabular-nums shrink-0 ${
            isCancelled ? "line-through" : ""
          }`}
        >
          {appointment.time_start}–{appointment.time_end}
        </div>

        {/* Line 2: title (client name OR personal event title). Wraps
            up to 2 lines so long titles like «Чистка кондиционера для
            Магнолии корт» stay readable instead of being truncated to
            "Чистка..." */}
        {clientName && (
          <div
            className={`text-[11px] lg:text-[12px] font-bold leading-tight break-words shrink-0 ${
              isCancelled ? "line-through opacity-80" : ""
            }`}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {clientName}
            {appointment.service_ids.length > 0 && (
              <span className="font-normal opacity-80"> · {appointment.service_ids.length > 1 ? `${appointment.service_ids.length} усл.` : ""}</span>
            )}
          </div>
        )}

        {/* Line 3+: rich body — service summary, event notes, address,
            URL. v500 — fills the remaining block height with multi-line
            wrapping text (Bumpix-style rich event card). Each fragment
            is on its own line; empty fragments are skipped. */}
        {(() => {
          const fragments: string[] = [];
          if (serviceSummary) fragments.push(serviceSummary);
          // Personal-event notes (event_notes) carry the free-form
          // description the user typed in the «Заметка» field.
          const notes = appointment.event_notes?.trim();
          if (notes) fragments.push(notes);
          // For non-event appointments, the comment beyond the first
          // line carries the dispatcher's note. The first line is
          // already used as `clientName`, so we surface the rest here.
          if (!appointment.event_notes && appointment.comment) {
            const rest = appointment.comment.split("\n").slice(1).join("\n").trim();
            if (rest) fragments.push(rest);
          }
          const addr = appointment.address?.trim();
          if (addr) fragments.push(addr);
          const url = appointment.event_url?.trim();
          if (url) fragments.push(url);
          if (fragments.length === 0) return null;
          return (
            <div
              // STORY audit (design-keeper): block body text 10→11 (phone)
              // / 11→12 (lg) — typography floor. Multi-line address/notes
              // were unreadable on a 40-px-wide slot.
              className="text-[11px] lg:text-[12px] opacity-90 leading-snug break-words whitespace-pre-wrap min-w-0 flex-1 overflow-hidden"
            >
              {fragments.join("\n")}
            </div>
          );
        })()}

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
