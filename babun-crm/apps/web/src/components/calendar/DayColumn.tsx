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
import { useCalendarSettings } from "@/app/dashboard/layout";
import type { Service } from "@/lib/services";
import { getServiceMaterialCost } from "@/lib/services";
import type { Client } from "@/lib/clients";
import { getCityConfig, getCityBg, cityConfigFromColor, type CityConfig } from "@/lib/day-cities";
import type { City } from "@/lib/cities";
import AppointmentBlock from "./AppointmentBlock";

interface DayColumnProps {
  date: Date;
  today: Date;
  appointments: Appointment[];
  clientsById: Record<string, Client>;
  services: Service[];
  validateApt: (apt: Appointment) => ValidationResult;
  currentTimeMinutes: number;
  schedule?: TeamSchedule;
  cityLabel?: string; // "Пафос" | "Лимассол" etc — shown under day header
  /** Sprint 033: settings.cities lookup so custom tags (Германия,
   *  День ног…) with user-picked colours render correctly. If a
   *  matching City has a `color`, we derive a CityConfig from it.
   *  Falls back to the legacy hardcoded CITIES dict. */
  cityLookup?: City[];
  /** Sprint 033: visible hour window. Everything outside [windowStart,
   *  windowEnd) is clipped from the grid so a brigade can run a
   *  tighter 06:00–23:30 calendar without scrolling past empty hours.
   *  Defaults to 0..24 = full day. */
  windowStart?: number;
  windowEnd?: number;
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
// Convert minutes-from-midnight to a CSS `calc()` height in hour units.
// Accepts an optional `offsetMin` so the caller can render a subset of
// the day (see Sprint 033: brigade calendar window — only 06:00–23:30
// is visible, everything else is clipped).
const minsOffset = (m: number, offsetMin: number): string =>
  `calc(var(--hh) * ${(m - offsetMin) / 60})`;
const mins = (m: number) => minsOffset(m, 0);

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
  cityLookup,
  windowStart = 0,
  windowEnd = 24,
}: DayColumnProps) {
  const windowStartMin = Math.max(0, Math.min(24, windowStart)) * 60;
  const windowEndMin = Math.max(windowStartMin, Math.min(24, windowEnd) * 60);
  const windowDurationMin = Math.max(60, windowEndMin - windowStartMin); // at least 1 hour
  const windowedMins = (m: number) => minsOffset(m, windowStartMin);
  void mins; // keep reference to please tsc until the few legacy callers are ported
  const dateKeyFromDate = formatDateKey(date);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-${dateKeyFromDate}`,
    data: { dateKey: dateKeyFromDate },
    disabled: !dragEnabled,
  });
  const isToday = isSameDay(date, today);
  const dateKey = formatDateKey(date);

  // Phase I35 — filter cancelled from grid when hideCancelled is on.
  const { calendarSettings } = useCalendarSettings();
  const hideCancelled = calendarSettings.hideCancelled ?? false;
  const dayAppointments = appointments.filter((a) => {
    if (a.date !== dateKey) return false;
    if (hideCancelled && a.status === "cancelled") return false;
    return true;
  });
  const dayName = getDayNameShort(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const monthShort = getMonthNameShort(date.getMonth());
  const isFirstOfMonth = date.getDate() === 1;
  // Prefer user-extended City.color (custom tags like «Германия»,
  // «День ног»). Fall back to the legacy hardcoded CITIES dict for
  // the original 4 Cyprus presets. Finally null = neutral grey chip.
  const cityCfg: CityConfig | null = (() => {
    if (!cityLabel) return null;
    const custom = cityLookup?.find((c) => c.name === cityLabel && c.color);
    if (custom?.color) return cityConfigFromColor(custom.name, custom.color);
    return getCityConfig(cityLabel);
  })();
  const cityBg = cityCfg ? (isToday ? cityCfg.bgToday : cityCfg.bg) : (cityLabel ? getCityBg(cityLabel, isToday) : null);
  const cityHex = cityCfg?.color ?? null;
  // Narrow week-view columns (≈56-64 px on iPhone 14) can't fit even
  // a 5-char uppercase Cyrillic label — "ЛАРНА." / "ЛИМАС." got clipped
  // by the column right edge in v231 (user report, Sprint 032 P5). So
  // we drop to a 3-letter code: "ПАФ", "ЛАР", "ЛИМ", "НИК". Short
  // names (≤ 3 chars) keep their form. Full name still lives in the
  // CityPickerModal and tap-hint, this is just the header chip.
  const cityShort = cityLabel
    ? cityLabel.length > 3
      ? cityLabel.slice(0, 3)
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
    // The column spans `windowDurationMin` minutes — derive pxPerMinute
    // from the live rendered height rather than a prop, so it stays
    // accurate during zoom. Offset by windowStartMin so the first
    // rendered hour still maps to the real calendar time.
    const totalHeight = rect.height;
    const pxPerMinute = totalHeight / windowDurationMin;
    const totalMinutes = windowStartMin + clickY / pxPerMinute;
    // STORY-005: тап по ячейке всегда даёт начало часа — диспетчер не
    // попадает в 16:15 случайно. Длительность рассчитывается отдельно
    // из выбранных услуг.
    const hours = Math.floor(totalMinutes / 60);
    const mm = 0;

    if (hours >= 0 && hours < 24) {
      const timeStr = `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      onEmptySlotClick(dateKey, timeStr);
    }
  };

  return (
    <div className="flex-1 min-w-0 border-r border-[var(--separator)] last:border-r-0 overflow-x-clip">
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
      {/* Sprint 030.1:
          • Today no longer lives in a filled circle — CEO wanted the
            iOS-lite treatment: the number itself turns accent and gets
            a 2-px accent underline under it. Reads as "selected" at a
            glance without the loud coloured disc.
          • City is now the dominant chrome of the header: a full-name
            tinted pill (bg = city bg, text = city color). The pill is
            twinned with a 3-px city-color stripe at the top of the
            body below — so when scanning a whole week the dispatcher
            sees a row of coloured stripes, one per city, even before
            reading the text. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${cityShort || "Без города"}, ${dayName} ${date.getDate()} ${monthShort} — сменить город`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onCityTap?.(dateKey);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onDayHeaderTap?.(dateKey);
        }}
        className="relative sticky top-0 z-20 h-[64px] lg:h-[70px] bg-[var(--surface-card)] border-b border-[var(--separator)] overflow-hidden text-center cursor-pointer active:bg-[var(--fill-quaternary)] transition"
      >
        <div className="relative z-10 px-1 pt-1.5 flex flex-col items-center gap-[2px] leading-none">
          {/* Weekday label. Red on weekends, muted otherwise. */}
          <span
            className={`text-[12px] font-semibold uppercase tracking-wider ${
              isWeekend
                ? "text-[var(--system-red)]/70"
                : "text-[var(--label-secondary)]"
            }`}
          >
            {dayName}
            {isFirstOfMonth && (
              <span className="ml-1 opacity-80">{monthShort}</span>
            )}
          </span>

          {/* Day number. Today → accent colour + 2-px accent underline;
              otherwise label-primary (or red on weekends). */}
          <span className="relative inline-flex items-center justify-center pb-[3px]">
            <span
              className={`text-[22px] font-semibold tabular-nums tracking-tight ${
                isToday
                  ? "text-[var(--accent)]"
                  : isWeekend
                    ? "text-[var(--system-red)]"
                    : "text-[var(--label)]"
              }`}
            >
              {date.getDate()}
            </span>
            {isToday && (
              <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[2px] w-[20px] rounded-full bg-[var(--accent)]" />
            )}
          </span>

          {/* City pill — main visual anchor of the header. Fully
              filled with the city's accent colour so it reads as a
              hard "label" on the column, not a tinted hint (user
              ask, Sprint 033 Phase I4). 3-letter uppercase code
              (ПАФ / ЛАР / ЛИМ) fits even the narrowest week-view
              column. */}
          {cityShort ? (
            <span
              className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full text-[12px] font-bold uppercase tracking-wide max-w-full whitespace-nowrap"
              style={{
                background: cityCfg?.color ?? "var(--fill-primary)",
                color: cityCfg ? "var(--label-on-accent)" : "var(--label-secondary)",
              }}
            >
              {cityShort}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center h-[18px] px-1 rounded-full text-[12px] font-medium text-[var(--label-tertiary)] bg-[var(--fill-tertiary)] whitespace-nowrap">
              + гор
            </span>
          )}
        </div>

        {dayAppointments.length > 0 && (
          <span className="absolute top-1 right-1.5 z-10 text-[12px] font-semibold tabular-nums text-[var(--label-tertiary)]">
            {dayAppointments.length}
          </span>
        )}
      </div>

      {/* Time slots — total height is 24×hourHeight via CSS var. */}
      <div
        ref={setDroppableRef}
        className={`relative cursor-pointer border-r border-[var(--separator)] select-none ${
          isOver ? "ring-2 ring-[var(--accent)] ring-inset" : ""
        }`}
        onClick={handleColumnClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          height: `calc(var(--hh) * ${windowDurationMin / 60})`,
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          // Sprint 030.1: 3-px coloured top stripe per city — visible
          // even when glancing at a full week without reading labels.
          // Sits above the hourly grid via a separate gradient layer.
          borderTop: cityCfg
            ? `3px solid ${cityCfg.color}`
            : "3px solid transparent",
          backgroundColor: isToday
            ? "rgba(124,58,237,0.04)"
            : isWeekend
              ? "rgba(60,60,67,0.02)"
              : cityCfg
                ? `${cityCfg.bg}60` // ~38% tint of the city background
                : "#FFFFFF",
          // Hourly grid — hairlines at each hour line, softer at half-hour.
          backgroundImage: [
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) - 1px), rgba(60,60,67,0.12) calc(var(--hh) - 1px), rgba(60,60,67,0.12) var(--hh))",
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) / 2 - 1px), rgba(60,60,67,0.06) calc(var(--hh) / 2 - 1px), rgba(60,60,67,0.06) calc(var(--hh) / 2))",
          ].join(","),
          contain: "layout paint",
        }}
      >
        {/* Out-of-hours overlay: BEFORE work start (but only within window) */}
        {workStart > windowStartMin && (
          <div
            className="absolute left-0 right-0 top-0 bg-[var(--fill-tertiary)] pointer-events-none"
            style={{ height: windowedMins(Math.max(workStart, windowStartMin)) }}
          />
        )}

        {/* Out-of-hours overlay: AFTER work end (but only within window) */}
        {workEnd < windowEndMin && (
          <div
            className="absolute left-0 right-0 bg-[var(--fill-tertiary)] pointer-events-none"
            style={{
              top: windowedMins(Math.max(workEnd, windowStartMin)),
              height: `calc(var(--hh) * ${(windowEndMin - Math.max(workEnd, windowStartMin)) / 60})`,
            }}
          />
        )}

        {/* Break overlays */}
        {daySched.is_working &&
          (daySched.breaks ?? []).map((br, i) => {
            const bs = timeToMinutes(br.start);
            const be = timeToMinutes(br.end);
            if (be <= bs) return null;
            // Clip breaks to the visible window.
            const visibleStart = Math.max(bs, windowStartMin);
            const visibleEnd = Math.min(be, windowEndMin);
            if (visibleEnd <= visibleStart) return null;
            return (
              <div
                key={i}
                className="absolute left-0 right-0 bg-[var(--fill-secondary)] pointer-events-none border-y border-[var(--separator)]"
                style={{
                  top: windowedMins(visibleStart),
                  height: `calc(var(--hh) * ${(visibleEnd - visibleStart) / 60})`,
                }}
              >
                <div className="text-[12px] text-[var(--label-secondary)] pl-1">Перерыв</div>
              </div>
            );
          })}

        {/* Sprint 033 Phase I27 — removed the per-column red dot.
            WeekView now renders a single stripe + anchor dot scoped
            to today's column (Phase I22). Rendering both left a
            visible duplicate/stub when scrolled near the now-line. */}

        {/* Phase I35 — buffer bands after each live appointment.
            Hatched grey stripe = «забронировано под дорогу / уборку».
            Rendered BEFORE appointment blocks so colour cards sit on
            top. Skipped for cancelled. */}
        {(calendarSettings.bufferMinutes ?? 0) > 0 &&
          dayAppointments.map((apt) => {
            if (apt.status === "cancelled") return null;
            const endMin = timeToMinutes(apt.time_end);
            const bufferMin = calendarSettings.bufferMinutes ?? 0;
            return (
              <div
                key={`buffer-${apt.id}`}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: windowedMins(endMin),
                  height: `calc(var(--hh) * ${bufferMin / 60})`,
                  background:
                    "repeating-linear-gradient(-45deg, rgba(60,60,67,0.08) 0 4px, transparent 4px 8px)",
                }}
              />
            );
          })}

        {/* Appointment blocks — with overlap detection.
            When 2+ appointments overlap in time, they display
            side-by-side (each gets a fraction of the width) so
            nothing is hidden. */}
        {(() => {
          // Compute column layout for overlapping appointments
          const layout = computeOverlapLayout(dayAppointments);
          // Phase I35 — appointments whose end time has passed get
          // rendered at reduced opacity so the dispatcher sees the
          // present/future stand out.
          const nowMs = Date.now();
          return dayAppointments.map((apt) => {
            const validation = validateApt(apt);
            const client = apt.client_id ? clientsById[apt.client_id] : null;
            const colorKind = getAppointmentColorKind(
              apt,
              validation,
              undefined,
              client?.property_type ?? null
            );
            const pos = layout.get(apt.id) ?? { col: 0, total: 1 };
            const widthPct = 100 / pos.total;
            const leftPct = pos.col * widthPct;
            const endIso = `${apt.date}T${apt.time_end}:00`;
            const endMs = Date.parse(endIso);
            const isPast = Number.isFinite(endMs) && endMs < nowMs;
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
                windowStartMin={windowStartMin}
                onClick={onAppointmentClick}
                onLongPress={onAppointmentLongPress}
                draggable={dragEnabled}
                dimmed={isPast}
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
