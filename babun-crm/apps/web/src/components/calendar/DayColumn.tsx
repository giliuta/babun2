"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  getDayNameShort,
  getMonthNameShort,
  isSameDay,
  formatDateKey,
} from "@/lib/date-utils";
import {
  timeToMinutes,
  getDayScheduleForDate,
  type TeamSchedule,
  DEFAULT_SCHEDULE,
} from "@/lib/schedule";
import type { Appointment, ValidationResult } from "@/lib/appointments";
import { getAppointmentColorKind, getPaidAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { getServiceMaterialCost } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import { getCityColor } from "@/lib/day-cities";
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
  cityLabel?: string; // "Пафос" | "Лимассол" etc — shown under day header
  onCityTap?: (dateKey: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onAppointmentLongPress?: (appointment: Appointment) => void;
  onEmptySlotClick?: (date: string, time: string) => void;
  onFooterTap?: (dateKey: string) => void;
  onDayHeaderTap?: (dateKey: string) => void;
  extraIncome?: number;
  extraExpense?: number;
  dragEnabled?: boolean;
  /** Resolver returning the team colour for a given appointment. */
  teamColorFor?: (apt: Appointment) => string | null;
}

// Expressions used for vertical positioning. They reference the live
// --hh CSS variable set on the outer scroller during pinch-zoom, so
// layout updates without any React re-render.
const mins = (m: number) => `calc(var(--hh) * ${m / 60})`;

// Compute side-by-side columns for overlapping appointments.
// Returns a Map of aptId → { col: 0-based column, total: columns in group }.
function computeOverlapLayout(apts: Appointment[]): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>();
  if (apts.length === 0) return result;

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const sorted = [...apts].sort((a, b) => toMin(a.time_start) - toMin(b.time_start));
  const groups: Appointment[][] = [];

  for (const apt of sorted) {
    const s = toMin(apt.time_start);
    const e = toMin(apt.time_end);
    let placed = false;

    for (const group of groups) {
      const overlaps = group.some((g) => {
        const gs = toMin(g.time_start);
        const ge = toMin(g.time_end);
        return s < ge && e > gs;
      });
      if (overlaps) {
        group.push(apt);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([apt]);
  }

  for (const group of groups) {
    const total = group.length;
    group.forEach((apt, col) => {
      result.set(apt.id, { col, total });
    });
  }

  return result;
}

function DayColumnInner({
  date,
  today,
  appointments,
  clientsById,
  services,
  validateApt,
  currentTimeMinutes,
  schedule = DEFAULT_SCHEDULE,
  cityLabel,
  onCityTap,
  onAppointmentClick,
  onAppointmentLongPress,
  onEmptySlotClick,
  onFooterTap,
  onDayHeaderTap,
  extraIncome = 0,
  extraExpense = 0,
  dragEnabled = false,
  teamColorFor,
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
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const monthShort = getMonthNameShort(date.getMonth());
  const isFirstOfMonth = date.getDate() === 1;
  const cityHex = cityLabel ? getCityColor(cityLabel) : null;

  const daySched = getDayScheduleForDate(schedule, date);
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
    <div className="flex-1 min-w-0 border-r border-gray-300 last:border-r-0 overflow-x-clip">
      {/* Day header — duplicates the column's right border because its
          background paints over the parent's border. Tap = focus this day
          (Bumpix-style shortcut to single-day view). Kept as <div> because
          the city label is a nested <button>. */}
      {/* Day header. Город выводится в каждом дне отдельно — Дима
          может менять город по-дневно. Цвет города рендерится как
          3-px полоска сверху + text-цвет на подписи. */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onDayHeaderTap?.(dateKey);
        }}
        className={`relative sticky top-0 z-20 h-[68px] lg:h-[78px] border-b border-gray-200 border-r border-gray-300 px-1 lg:px-2 pt-1.5 pb-1 text-center cursor-pointer active:bg-indigo-50 ${
          isToday
            ? "bg-emerald-50"
            : isWeekend
            ? "bg-amber-50/50"
            : "bg-white"
        }`}
      >
        {/* 3-px hairline in the city colour — колонка сразу «зона Пафоса» */}
        {cityHex && (
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: cityHex }}
          />
        )}

        {/* Top row: weekday + short month. Month показывается всегда,
            но компактно («апр», а не «АПРЕЛЯ»), так что 7 колонок
            не превращаются в визуальный шум. На 1-м числе месяц
            сильнее — boundary-marker, чтобы Дима сразу ловил переход
            апр→май без внимательного вглядывания. */}
        <div
          className={`flex items-center justify-center gap-1 leading-none ${
            isToday
              ? "text-emerald-700"
              : isWeekend
              ? "text-amber-600"
              : "text-gray-500"
          }`}
        >
          <span className="text-[10px] lg:text-[11px] font-semibold">
            {dayName.toUpperCase()}
          </span>
          <span
            className={`text-[9px] lg:text-[10px] uppercase tracking-wide ${
              isFirstOfMonth
                ? "font-bold"
                : "opacity-70 font-medium"
            }`}
          >
            {monthShort}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-center leading-none">
          <span
            className={`inline-flex items-center justify-center rounded-full transition ${
              isToday
                ? "w-8 h-8 lg:w-9 lg:h-9 bg-emerald-500 text-white text-[15px] lg:text-[17px] font-bold shadow-sm"
                : "text-[18px] lg:text-[20px] font-semibold text-gray-900"
            }`}
          >
            {date.getDate()}
          </span>
        </div>

        {/* City: per-day, minimal text in the city colour. Тап
            открывает city picker именно для этого дня. Если города
            нет — показываем количество записей если они есть. */}
        {cityLabel ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCityTap?.(dateKey);
            }}
            className="mt-1 mx-auto block max-w-full text-[10px] lg:text-[11px] font-medium truncate leading-none active:opacity-60"
            style={{ color: cityHex ?? undefined }}
          >
            {cityLabel}
            {dayAppointments.length > 0 && (
              <span className="opacity-60 ml-1">· {dayAppointments.length}</span>
            )}
          </button>
        ) : (
          dayAppointments.length > 0 && (
            <div className="mt-1 text-[10px] text-gray-400 leading-none">
              · {dayAppointments.length}
            </div>
          )
        )}
      </div>

      {/* Time slots — total height is 24×hourHeight via CSS var. Hour grid
          lines are drawn via a single repeating-linear-gradient instead of
          24 DOM elements, so pinch-zoom costs nothing. border-r echoes the
          column's outer border so that today's green tint does not hide
          the day separator. */}
      <div
        ref={setDroppableRef}
        className={`relative cursor-pointer border-r border-gray-300 select-none ${
          isToday
            ? "bg-emerald-50/40"
            : isWeekend
            ? "bg-amber-50/25"
            : "bg-white"
        } ${isOver ? "ring-2 ring-indigo-400 ring-inset" : ""}`}
        onClick={handleColumnClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          height: "calc(var(--hh) * 24)",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          // Hourly grid — a solid 1 px line in gray-200, with a subtle
          // dashed 0.5 h line at the mid-mark in gray-100 for rhythm.
          backgroundImage: [
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) - 1px), rgb(209 213 219) calc(var(--hh) - 1px), rgb(209 213 219) var(--hh))",
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) / 2 - 1px), rgb(243 244 246) calc(var(--hh) / 2 - 1px), rgb(243 244 246) calc(var(--hh) / 2))",
          ].join(","),
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

        {/* Appointment blocks — with overlap detection.
            When 2+ appointments overlap in time, they display
            side-by-side (each gets a fraction of the width) so
            nothing is hidden. */}
        {(() => {
          // Compute column layout for overlapping appointments
          const layout = computeOverlapLayout(dayAppointments);
          return dayAppointments.map((apt) => {
            const validation = validateApt(apt);
            const colorKind = getAppointmentColorKind(apt, validation);
            const pos = layout.get(apt.id) ?? { col: 0, total: 1 };
            const widthPct = 100 / pos.total;
            const leftPct = pos.col * widthPct;
            return (
              <AppointmentBlock
                key={apt.id}
                appointment={apt}
                colorKind={colorKind}
                clientsById={clientsById}
                services={services}
                teamColor={teamColorFor?.(apt) ?? null}
                onClick={onAppointmentClick}
                onLongPress={onAppointmentLongPress}
                draggable={dragEnabled}
                overlapStyle={
                  pos.total > 1
                    ? { left: `${leftPct}%`, width: `${widthPct}%` }
                    : undefined
                }
              />
            );
          });
        })()}
      </div>

      {/* Day totals footer — tap to open DayFinanceModal */}
      <button
        type="button"
        onClick={() => onFooterTap?.(dateKey)}
        className="sticky bottom-0 z-10 w-full text-left border-t border-gray-200 border-r border-gray-300 bg-white/95 backdrop-blur-sm px-1 py-1 text-[9px] lg:text-[10px] active:bg-indigo-50"
      >
        <div className="flex justify-between text-emerald-600">
          <span>Доход</span>
          <span className="font-semibold">{dayIncome + extraIncome}€</span>
        </div>
        {(dayMaterialCost > 0 || extraExpense > 0) && (
          <div className="flex justify-between text-red-600">
            <span>Расход</span>
            <span className="font-semibold">
              {dayMaterialCost + extraExpense}€
            </span>
          </div>
        )}
        <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-0.5 mt-0.5">
          <span>Прибыль</span>
          <span>{dayProfit + extraIncome - extraExpense}€</span>
        </div>
      </button>
    </div>
  );
}

const DayColumn = memo(DayColumnInner);
export default DayColumn;
