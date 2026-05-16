"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  getDayNameShort,
  getMonthNameShort,
  isSameDay,
  formatDateKey,
} from "@babun/shared/common/utils/date-utils";
import {
  timeToMinutes,
  getDayScheduleForDate,
  type TeamSchedule,
  DEFAULT_SCHEDULE,
} from "@babun/shared/local/schedule";
import type { Appointment, ValidationResult } from "@babun/shared/local/appointments";
import { getAppointmentColorKind, getPaidAmount } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { getServiceMaterialCost } from "@babun/shared/local/services";
import type { Client } from "@babun/shared/local/clients";
import { getCityConfig, getCityBg, cityConfigFromColor, type CityConfig } from "@babun/shared/local/day-cities";
import type { City } from "@babun/shared/local/cities";
import { MapPin } from "@babun/shared/icons";
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
  /** Phase I36 — snap granularity for empty-cell taps, minutes.
   *  Also used as the created appointment duration. Default 60. */
  snapMinutes?: number;
  /** Phase I38 — show the per-day label chip only if the brigade has
   *  any labels configured. When false the chip disappears entirely
   *  and the day header shows just weekday + number. */
  hasLabels?: boolean;
  /** Phase I39 — effective «behaviour» resolved by the parent:
   *  brigade value overrides global when provided. */
  hideCancelled?: boolean;
  bufferMinutes?: number;
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

// Compute side-by-side columns for overlapping TIMED appointments.
// All-day events are excluded — they get a separate left-strip render
// pass so they don't squeeze the rest of the day's timed events into
// narrow slices (v496).
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

// v496 — all-day events become left-edge strips so they don't fight
// timed events for column width. Width is fixed (no overlap math);
// when multiple all-day events stack on the same day, they slot in
// next to each other from the left edge.
const ALL_DAY_STRIP_PX = 8;
const ALL_DAY_STRIP_GAP_PX = 2;

// v498 — visual separation between side-by-side overlapping events.
// 3 px gap on the right of every block except the rightmost — enough
// to read as «two distinct cards» on a phone column without stealing
// significant width when 3+ events stack. Combined with the rounded
// corners + shadow on AppointmentBlock, side-by-side now reads as
// real cards instead of one merged blob.
const OVERLAP_GAP_PX = 3;

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
  snapMinutes = 60,
  hasLabels = true,
  hideCancelled = false,
  bufferMinutes = 0,
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

  // Phase I35/I39 — filter cancelled from grid when hideCancelled is
  // on. Value resolved by the parent: brigade-level override wins
  // over global «Мой календарь».
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
    // Phase I36 — snap to multiples of `snapMinutes` (командная
    // настройка 15/30/60). 15 → 11:00/11:15/11:30/11:45; 30 → 11:00/
    // 11:30/12:00; 60 → 11:00/12:00. Floor so тап в 11:27 при 30 мин
    // ложится на 11:00, а не на 11:30 (user picks the start of the
    // slot where their finger landed).
    const snap = Math.max(5, Math.min(60, snapMinutes));
    const snapped = Math.max(0, Math.floor(totalMinutes / snap) * snap);
    const hours = Math.floor(snapped / 60);
    const mm = snapped % 60;

    if (hours >= 0 && hours < 24) {
      const timeStr = `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      onEmptySlotClick(dateKey, timeStr);
    }
  };

  return (
    <div
      data-testid={`calendar-day-column-${dateKey}`}
      data-date-key={dateKey}
      className="flex-1 min-w-0 border-r border-[var(--separator)] last:border-r-0 overflow-x-clip"
    >
      {/* Day header — по спеке:
            1. City name в цвете города (крупно, bold) + ChevronDown
            2. Weekday (ПН/ВТ...) + короткий месяц
            3. Число дня
          Весь столбец (и header и тело) тонируется в bg города
          (bgToday если сегодня). Тап открывает bottom sheet для
          смены города команды на этот день. */}
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
          if (!hasLabels) return;
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

          {/* Label pill — main visual anchor of the header.
              Phase I38: hide entirely when the brigade has no labels
              configured — nothing to offer, the day header falls back
              to just weekday + number. */}
          {/* Brief 1 #9: label pill carries a pin icon + native hover
              tooltip with the full city name, so a hovering dispatcher
              sees «Пафос» without having to remember «ПАФ». */}
          {hasLabels &&
            (cityShort ? (
              <span
                className="inline-flex items-center justify-center gap-0.5 h-[18px] px-1.5 rounded-full text-[12px] font-bold uppercase tracking-wide max-w-full whitespace-nowrap"
                title={cityLabel}
                style={{
                  background: cityCfg?.color ?? "var(--fill-primary)",
                  color: cityCfg ? "var(--label-on-accent)" : "var(--label-secondary)",
                }}
              >
                <MapPin size={9} strokeWidth={2.5} aria-hidden />
                {cityShort}
              </span>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-0.5 h-[18px] px-1.5 rounded-full text-[11px] font-medium text-[var(--label-tertiary)] bg-[var(--fill-tertiary)] whitespace-nowrap"
                title="Добавить метку дня"
              >
                <MapPin size={9} strokeWidth={2.5} aria-hidden />
                метка
              </span>
            ))}
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
        data-testid={`calendar-day-grid-${dateKey}`}
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
          // Phase I41 — label colour paints the whole day column
          // lightly. cityCfg.bg / bgToday are already rgba(…,0.08) /
          // rgba(…,0.16) from cityConfigFromColor, so using them
          // directly gives a consistent, subtle hue regardless of
          // whether the label is a hardcoded city or a tenant-
          // created tag. When no label is picked the column falls
          // back to today's purple / weekend grey / plain white.
          // v473 — dropped the `isWeekend` grey tint. The user reads
          // weekends from the red weekday label / day number in the
          // header; tinting the body column made Sat/Sun feel "off-
          // duty" even on the personal calendar where every day is
          // equal.
          backgroundColor: cityCfg
            ? isToday
              ? cityCfg.bgToday
              : cityCfg.bg
            : isToday
              ? "rgba(124,58,237,0.04)"
              : "#FFFFFF",
          // v491 — grid lines follow the «Шаг сетки» setting. Hour
          // line is always drawn (12% alpha hairline). Sub-hour lines
          // appear when snapMinutes < 60:
          //   • 30 → one half-hour line per hour
          //   • 15 → quarter-hour lines (3 sub-lines per hour)
          //   • 60 → no sub-lines, only hour separators.
          // Sub-lines are softer (6% alpha) so the hourly rhythm
          // stays the primary read.
          backgroundImage: (() => {
            const hourGrad =
              "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) - 1px), rgba(60,60,67,0.12) calc(var(--hh) - 1px), rgba(60,60,67,0.12) var(--hh))";
            const divisions =
              snapMinutes >= 60 ? 1 : Math.max(1, Math.round(60 / snapMinutes));
            if (divisions <= 1) return hourGrad;
            const subGrad = `repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--hh) / ${divisions} - 1px), rgba(60,60,67,0.06) calc(var(--hh) / ${divisions} - 1px), rgba(60,60,67,0.06) calc(var(--hh) / ${divisions}))`;
            return `${hourGrad}, ${subGrad}`;
          })(),
          contain: "layout paint",
        }}
      >
        {/* Phase I41 — past-time tint. Past days get the whole column
            slightly darker so the dispatcher scanning a week sees at
            a glance what's already behind. On today's column we tint
            only up to the now-line. Sits above the base background
            but below out-of-hours / appointment layers. */}
        {(() => {
          const todayYmd = formatDateKey(today);
          const isPastDay = !isToday && dateKey < todayYmd;
          const isFutureDay = !isToday && dateKey > todayYmd;
          if (isFutureDay) return null;
          if (isPastDay) {
            return (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "rgba(60,60,67,0.06)" }}
              />
            );
          }
          // Today — overlay from top of the window to the current minute.
          if (currentTimeMinutes <= windowStartMin) return null;
          const height = windowedMins(
            Math.min(currentTimeMinutes, windowEndMin),
          );
          return (
            <div
              className="absolute left-0 right-0 top-0 pointer-events-none"
              style={{
                height,
                background: "rgba(60,60,67,0.05)",
              }}
            />
          );
        })()}

        {/* Out-of-hours overlays — only meaningful for working days.
            v473 — when `is_working` is false (Sat/Sun marked as off
            on the personal calendar), workStart/workEnd both collapse
            to 0, which made the AFTER overlay span the entire column
            and lit weekends darker than weekdays. The user reads the
            day-off signal from the red weekday header, so the body
            stays plain white instead. */}
        {daySched.is_working && workStart > windowStartMin && (
          <div
            className="absolute left-0 right-0 top-0 bg-[var(--fill-tertiary)] pointer-events-none"
            style={{ height: windowedMins(Math.max(workStart, windowStartMin)) }}
          />
        )}

        {daySched.is_working && workEnd < windowEndMin && (
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

        {/* Phase I35/I39 — buffer bands after each live appointment.
            Hatched grey stripe = «забронировано под дорогу / уборку».
            Rendered BEFORE appointment blocks so colour cards sit on
            top. Skipped for cancelled. Value resolved by parent
            (brigade-level override wins over global). */}
        {bufferMinutes > 0 &&
          dayAppointments.map((apt) => {
            if (apt.status === "cancelled") return null;
            const endMin = timeToMinutes(apt.time_end);
            const bufferMin = bufferMinutes;
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
            v496 — all-day events render as thin strips on the LEFT
            edge of the column (no overlap math). Timed events
            compute their side-by-side layout among themselves so
            they always get the full remaining width, not a 1/N
            slice next to the all-day bar. */}
        {(() => {
          const allDay = dayAppointments.filter(
            (a) => a.event_all_day === true,
          );
          const timed = dayAppointments.filter(
            (a) => a.event_all_day !== true,
          );

          // Reserve the leftmost N strips (one per all-day event)
          // so timed events know how far to offset.
          const reservedPx =
            allDay.length === 0
              ? 0
              : allDay.length * ALL_DAY_STRIP_PX +
                Math.max(0, allDay.length - 1) * ALL_DAY_STRIP_GAP_PX;
          const timedOffset = reservedPx > 0 ? `${reservedPx + 4}px` : "0px";

          const layout = computeOverlapLayout(timed);
          // Phase I35 — appointments whose end time has passed get
          // rendered at reduced opacity so the dispatcher sees the
          // present/future stand out.
          const nowMs = Date.now();

          const renderApt = (
            apt: Appointment,
            override?: { left: string; width: string },
          ) => {
            const validation = validateApt(apt);
            const client = apt.client_id ? clientsById[apt.client_id] : null;
            const colorKind = getAppointmentColorKind(
              apt,
              validation,
              undefined,
              client?.property_type ?? null,
            );
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
                teamColor={cityHex ?? teamColorFor?.(apt) ?? null}
                windowStartMin={windowStartMin}
                onClick={onAppointmentClick}
                onLongPress={onAppointmentLongPress}
                draggable={dragEnabled}
                dimmed={isPast}
                overlapStyle={override}
              />
            );
          };

          return (
            <>
              {allDay.map((apt, idx) => {
                const left =
                  idx * (ALL_DAY_STRIP_PX + ALL_DAY_STRIP_GAP_PX);
                return renderApt(apt, {
                  left: `${left}px`,
                  width: `${ALL_DAY_STRIP_PX}px`,
                });
              })}
              {timed.map((apt) => {
                const pos = layout.get(apt.id) ?? { col: 0, total: 1 };
                // v498 — slot width includes gap reservation. Each block
                // is `slot - gap` wide, leaving `OVERLAP_GAP_PX` between
                // adjacent blocks (or to the column's right edge for
                // the rightmost block, keeping the grid line clear).
                const slotCalc = `((100% - ${timedOffset}) / ${pos.total})`;
                const widthCalc = `calc(${slotCalc} - ${OVERLAP_GAP_PX}px)`;
                const leftCalc = `calc(${timedOffset} + ${slotCalc} * ${pos.col})`;
                if (pos.total === 1 && reservedPx === 0) {
                  return renderApt(apt, undefined);
                }
                return renderApt(apt, {
                  left: leftCalc,
                  width: widthCalc,
                });
              })}
            </>
          );
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
