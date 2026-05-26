"use client";

import { memo } from "react";

interface TimeColumnProps {
  /** Sprint 033: visible hour window. Defaults to 0..24 = full day.
   *  When a brigade narrows the calendar (e.g. 06:00–23:30), only the
   *  matching hour labels are rendered so the column lines up with
   *  DayColumn's clipped grid. */
  startHour?: number;
  endHour?: number;
}

// Standalone time column rendered OUTSIDE the swipeable area, so it stays
// fixed on the left while the user swipes between weeks.
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeColumnInner({ startHour = 0, endHour = 24 }: TimeColumnProps) {
  const from = Math.max(0, Math.min(23, Math.floor(startHour)));
  const to = Math.max(from + 1, Math.min(24, Math.ceil(endHour)));
  const visibleHours = HOURS.slice(from, to);
  return (
    // The time/grid divider is a plain `border-right` on the column
    // itself — NOT an absolutely-positioned overlay. Earlier attempts:
    //  · Absolute line OUTSIDE the column → drifted at sub-pixel zoom.
    //  · Absolute line INSIDE the column (top-0 right-0 bottom-0) →
    //    still jittered: its `bottom-0` height recomputed every pinch
    //    frame while applyZoom wrote scrollTop synchronously, so the
    //    line visibly shifted while zooming/scrolling.
    //  · border-right + per-hour border-b → tiny gaps at every hour
    //    boundary where the row border-b anti-aliased against the
    //    border-r corner.
    // Fix: keep the divider as a static border-right and DROP the
    // per-hour border-b (the day grid already paints the hour lines,
    // so the time column doesn't need its own). The border is part of
    // the element at a fixed x, full height — it can't drift on zoom
    // or scroll. Width 1.5px ≈ 3 device px on retina; ~26 % alpha lands
    // clearly above the inter-day hairlines without looking heavy.
    <div
      className="w-12 lg:w-16 flex-shrink-0 bg-[var(--surface-card)]"
      style={{ borderRight: "1.5px solid rgba(60, 60, 67, 0.26)" }}
    >
      {/* Header spacer must match DayColumn header exactly, else hour
          labels drift vs the grid rows under pinch-zoom. */}
      <div className="sticky top-0 z-30 h-[64px] lg:h-[70px] border-b border-[var(--separator-opaque)] bg-[var(--surface-card)]" />

      {visibleHours.map((hour, idx) => (
        <div
          key={hour}
          className="flex items-start justify-end pr-1.5 lg:pr-2"
          style={{ height: "var(--hh)", boxSizing: "border-box" }}
        >
          {/* v451 — первая метка не уходит в отрицательный margin,
              иначе её обрезает верх viewport'а (юзер: «оно тут
              закрывает кусочек времени»). Остальные сидят НА часовой
              линии в iOS-стиле. */}
          <span
            className={`text-[12px] lg:text-[13px] font-semibold text-[var(--label)] select-none tabular-nums ${idx === 0 ? "mt-0.5" : "-mt-2"}`}
          >
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

const TimeColumn = memo(TimeColumnInner);
export default TimeColumn;
export { HOURS };
