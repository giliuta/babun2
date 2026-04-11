"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  getDayNameShort,
  getMonthNameGenitive,
  isSameDay,
  formatDateKey,
} from "@/lib/date-utils";
import {
  timeToMinutes,
  getDaySchedule,
  type TeamSchedule,
  DEFAULT_SCHEDULE,
} from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import { getAppointmentColorKind, getPaidAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { getServiceMaterialCost } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/components/appointments/AppointmentForm";
import AppointmentBlock from "./AppointmentBlock";

interface DayColumnProps {
  date: Date;
  today: Date;
  appointments: Appointment[];
  clientsById: Record<string, Client | DraftClient>;
  services: Service[];
  validateApt: (apt: Appointment) => ValidationResult;
  currentTimeMinutes: number;
  schedule?: TeamSchedule;
  onAppointmentClick: (appointment: Appointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
  dragEnabled?: boolean;
}

// Expressions used for vertical positioning. They reference the live
// --hh CSS variable set on the outer scroller during pinch-zoom, so
// layout updates without any React re-render.
const mins = (m: number) => `calc(var(--hh) * ${m / 60})`;

function DayColumnInner({
  date,
  today,
  appointments,
  clientsById,
  services,
  validateApt,
  currentTimeMinutes,
  schedule = DEFAULT_SCHEDULE,
  onAppointmentClick,
  onEmptySlotClick,
  dragEnabled = false,
}: DayColumnProps) {
  const dateKeyFromDate = formatDateKey(date);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-${dateKeyFromDate}`,
    data: { dateKey: dateKeyFromDate },
    disabled: !dragEnabled,
  });
  const isToday = isSameDay(date, today);
  const dateKey = formatDateKey(date);
  const dayAppointments = appointments.filter((a) => a.date === dateKey);
  const dayName = getDayNameShort(date);
  const monthName = getMonthNameGenitive(date.getMonth());

  const daySched = getDaySchedule(schedule, date.getDay());
  const workStart = timeToMinutes(daySched.is_working ? daySched.start : "00:00");
  const workEnd = timeToMinutes(daySched.is_working ? daySched.end : "00:00");

  const dayIncome = dayAppointments
    .filter((a) => a.status === "completed" || a.status === "in_progress")
    .reduce((sum, a) => sum + getPaidAmount(a), 0);
  const dayMaterialCost = dayAppointments
    .filter((a) => a.status === "completed" || a.status === "in_progress")
    .reduce((sum, a) => {
      const cost = a.service_ids.reduce((c, sid) => {
        const s = services.find((x) => x.id === sid);
        return c + (s ? getServiceMaterialCost(s) : 0);
      }, 0);
      return sum + cost;
    }, 0);
  const dayProfit = dayIncome - dayMaterialCost;

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onEmptySlotClick) return;
    if ((e.target as HTMLElement).closest("button")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    // Total column height is 24 hours — derive pxPerMinute from the live
    // rendered height rather than a prop, so it stays accurate during zoom.
    const totalHeight = rect.height;
    const pxPerMinute = totalHeight / (24 * 60);
    const totalMinutes = clickY / pxPerMinute;

    const snapped = Math.round(totalMinutes / 15) * 15;
    const hours = Math.floor(snapped / 60);
    const mm = snapped % 60;

    if (hours >= 0 && hours < 24) {
      const timeStr = `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      onEmptySlotClick(dateKey, timeStr);
    }
  };

  return (
    <div className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0 overflow-x-clip">
      {/* Day header */}
      <div
        className={`sticky top-0 z-20 h-[52px] lg:h-[72px] border-b border-gray-200 px-1 lg:px-2 py-1 lg:py-2 text-center ${
          isToday ? "bg-green-50" : "bg-white"
        }`}
      >
        <div className="text-[8px] lg:text-[10px] text-gray-400 uppercase truncate">{monthName}</div>
        <div
          className={`text-base lg:text-xl font-bold leading-tight ${
            isToday ? "text-green-600" : "text-gray-900"
          }`}
        >
          {date.getDate()}
        </div>
        <div className="flex items-center justify-center gap-0.5">
          <span
            className={`text-[10px] lg:text-xs font-medium ${
              isToday ? "text-green-600" : "text-gray-500"
            }`}
          >
            {dayName}
          </span>
          {dayAppointments.length > 0 && (
            <span className="text-[8px] lg:text-[10px] text-gray-400">
              ({dayAppointments.length})
            </span>
          )}
        </div>
      </div>

      {/* Time slots — total height is 24×hourHeight via CSS var. Hour grid
          lines are drawn via a single repeating-linear-gradient instead of
          24 DOM elements, so pinch-zoom costs nothing. */}
      <div
        ref={setDroppableRef}
        className={`relative cursor-pointer ${isToday ? "bg-green-50/30" : "bg-white"} ${
          isOver ? "ring-2 ring-indigo-400 ring-inset" : ""
        }`}
        onClick={handleColumnClick}
        style={{
          height: "calc(var(--hh) * 24)",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) - 1px), rgb(243 244 246) calc(var(--hh) - 1px), rgb(243 244 246) var(--hh))",
          contain: "layout paint",
        }}
      >
        {/* Out-of-hours overlay: BEFORE work start */}
        {workStart > 0 && (
          <div
            className="absolute left-0 right-0 top-0 bg-gray-200/50 pointer-events-none"
            style={{ height: mins(workStart) }}
          />
        )}

        {/* Out-of-hours overlay: AFTER work end */}
        {workEnd < 24 * 60 && (
          <div
            className="absolute left-0 right-0 bg-gray-200/50 pointer-events-none"
            style={{
              top: mins(workEnd),
              height: `calc(var(--hh) * ${(24 * 60 - workEnd) / 60})`,
            }}
          />
        )}

        {/* Break overlays */}
        {daySched.is_working &&
          (daySched.breaks ?? []).map((br, i) => {
            const bs = timeToMinutes(br.start);
            const be = timeToMinutes(br.end);
            if (be <= bs) return null;
            return (
              <div
                key={i}
                className="absolute left-0 right-0 bg-gray-300/60 pointer-events-none border-y border-gray-400/40"
                style={{ top: mins(bs), height: mins(be - bs) }}
              >
                <div className="text-[9px] text-gray-600 pl-1">Перерыв</div>
              </div>
            );
          })}

        {/* Current time indicator */}
        {isToday && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: mins(currentTimeMinutes) }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          </div>
        )}

        {/* Appointment blocks */}
        {dayAppointments.map((apt) => {
          const validation = validateApt(apt);
          const colorKind = getAppointmentColorKind(apt, validation);
          return (
            <AppointmentBlock
              key={apt.id}
              appointment={apt}
              colorKind={colorKind}
              clientsById={clientsById}
              services={services}
              onClick={onAppointmentClick}
              draggable={dragEnabled}
            />
          );
        })}
      </div>

      {/* Day totals footer */}
      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-1 py-1 text-[9px] lg:text-[10px]">
        <div className="flex justify-between text-emerald-600">
          <span>Доход</span>
          <span className="font-semibold">{dayIncome}€</span>
        </div>
        {dayMaterialCost > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Расход</span>
            <span className="font-semibold">{dayMaterialCost}€</span>
          </div>
        )}
        <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-0.5 mt-0.5">
          <span>Прибыль</span>
          <span>{dayProfit}€</span>
        </div>
      </div>
    </div>
  );
}

const DayColumn = memo(DayColumnInner);
export default DayColumn;
