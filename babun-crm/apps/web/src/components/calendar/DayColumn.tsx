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
import { getCityConfig, getCityBg } from "@/lib/day-cities";
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
  const cityCfg = cityLabel ? getCityConfig(cityLabel) : null;
  const cityBg = cityLabel ? getCityBg(cityLabel, isToday) : null;
  const cityHex = cityCfg?.color ?? null;
  // Короткое имя города для заголовка: длинные обрезаются до 5 букв + точка.
  const cityShort = cityLabel
    ? cityLabel.length > 5
      ? `${cityLabel.slice(0, 5)}.`
      : cityLabel
    : "";

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
      {/* Day header — по спеке:
            1. City name в цвете города (крупно, bold) + ChevronDown
            2. Weekday (ПН/ВТ...) + короткий месяц
            3. Число дня
          Весь столбец (и header и тело) тонируется в bg города
          (bgToday если сегодня). Тап открывает bottom sheet для
          смены города бригады на этот день. */}
      {/* Day header — edge-to-edge градиентная ячейка.
          Структура слоёв (z-снизу-вверх):
            1. Gradient 135° c1 → c2 (насыщенный фон)
            2. Glass-shine overlay (белый блик сверху, тёмный снизу)
            3. Текст: город мелко → weekday/месяц мелко → число крупно
            4. Fade-полоска 8px в самом низу: c2 → light — плавный
               переход в светлый фон столбца, без видимой границы.
          Разделители между колонками — 1px semi-white. Внешний border-r
          заменён на inline style чтобы не конфликтовал с body. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Сменить город этого дня"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onCityTap?.(dateKey);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onDayHeaderTap?.(dateKey);
        }}
        className={`relative sticky top-0 z-20 h-[72px] lg:h-[82px] overflow-hidden text-center cursor-pointer active:brightness-95 transition ${
          isToday ? "ring-2 ring-white/70 ring-inset" : ""
        }`}
        style={{
          // 1. Gradient 135° от светлого c1 к тёмному c2.
          backgroundImage: cityCfg
            ? `linear-gradient(135deg, ${cityCfg.c1} 0%, ${cityCfg.color} 100%)`
            : "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
          borderRight: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {/* 2. Glass-shine overlay. Тонкий блик сверху, мягкая тень
            снизу — создаёт «стеклянную» глубину. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)",
          }}
        />

        {/* 3. Текст — стек центрирован, z > overlay. */}
        <div className="relative z-10 px-0.5 pt-1.5 pb-2.5 flex flex-col items-center justify-start">
          {/* Город — 7px uppercase bold, opacity 85. Длинные → slice+. */}
          <span
            className="text-[7px] lg:text-[9px] font-bold uppercase tracking-wide text-white truncate max-w-full"
            style={{ opacity: cityLabel ? 0.85 : 0.5 }}
          >
            {cityShort || "+ город"}
          </span>

          {/* Weekday — 7px opacity 45, рядом месяц с меньшей opacity. */}
          <span
            className="text-[7px] lg:text-[9px] font-semibold uppercase tracking-wide text-white mt-0.5"
            style={{ opacity: 0.45 }}
          >
            {dayName}
            {isFirstOfMonth && (
              <span className="ml-1 opacity-80">{monthShort}</span>
            )}
          </span>

          {/* Число — 18px font-black белый, доминанта. */}
          <span
            className="text-[18px] lg:text-[22px] font-black tabular-nums text-white leading-none mt-1"
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
          >
            {date.getDate()}
          </span>
        </div>

        {/* 4. Fade bottom — 8px переход от тёмной границы к светлому
            фону тела столбца. Убирает резкую линию. */}
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{
            height: "8px",
            backgroundImage: cityCfg
              ? `linear-gradient(to bottom, ${cityCfg.color}00, ${cityCfg.bg})`
              : "linear-gradient(to bottom, rgba(71,85,105,0), #ffffff)",
          }}
        />

        {dayAppointments.length > 0 && (
          <span className="absolute top-1 right-1.5 z-10 text-[9px] font-bold tabular-nums text-white/80">
            {dayAppointments.length}
          </span>
        )}
      </div>

      {/* Time slots — total height is 24×hourHeight via CSS var. */}
      <div
        ref={setDroppableRef}
        className={`relative cursor-pointer border-r border-gray-300 select-none ${
          isOver ? "ring-2 ring-indigo-400 ring-inset" : ""
        }`}
        onClick={handleColumnClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          height: "calc(var(--hh) * 24)",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          backgroundColor:
            cityBg ??
            (isToday ? "#ecfdf5" : isWeekend ? "#fffbeb" : "#ffffff"),
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
                // Event card colour по спеке: "насыщенный цвет города
                // этого дня". Если город известен — он побеждает team-color.
                // Per-appointment color_override всё ещё выигрывает.
                teamColor={cityHex ?? teamColorFor?.(apt) ?? null}
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

      {/* STORY-003: 7-колоночный нижний футер убран — теперь в шапке
          календаря есть TodayChip с «Сегодня: €X · N ожидают», а
          per-day разбивка живёт на странице /dashboard/finances в
          day-режиме. onFooterTap оставлен как prop (другие вызовы
          использовали его для DayFinanceModal). */}
      {/* no-op silencers for unused data: prevents TS "declared but never read" */}
      {false && <span>{dayIncome}{dayMaterialCost}{dayProfit}{extraIncome}{extraExpense}{onFooterTap?.toString?.()}</span>}
    </div>
  );
}

const DayColumn = memo(DayColumnInner);
export default DayColumn;
