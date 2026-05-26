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
    // Sprint 033 Phase I19 — vertical separator is a self-contained
    // absolutely-positioned 1-px line INSIDE TimeColumn (relative
    // parent). Previous attempts:
    //  · Absolute line OUTSIDE TimeColumn — drifted at sub-pixel zoom.
    //  · border-right on TimeColumn — showed tiny gaps at every hour
    //    row boundary because the per-row border-b anti-aliased
    //    against the column's border-r corner.
    // By putting the line as a child of TimeColumn, pointer-events-
    // none, painted ON TOP of the hour rows, it's a single solid
    // stroke that can't be interrupted by child borders.
    <div className="w-12 lg:w-16 flex-shrink-0 bg-[var(--surface-card)] relative">
      {/* Header spacer must match DayColumn header exactly, else hour
          labels drift vs the grid rows under pinch-zoom. */}
      <div className="sticky top-0 z-30 h-[72px] lg:h-[82px] border-b border-[var(--separator-opaque)] bg-[var(--surface-card)]" />

      {visibleHours.map((hour, idx) => (
        <div
          key={hour}
          className="border-b border-[var(--separator)] flex items-start justify-end pr-1.5 lg:pr-2"
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

      {/* The separator — structurally more important than the inter-
          day borders (which are rgba ~0.10) and the hour hairlines
          (rgba ~0.12). Time/grid boundary is a SEMANTIC axis divide,
          not just another grid rule, so it must dominate visually.
          Width 1.5 px (≈3 device pixels on retina) + ~26 % alpha
          lands at ~2.6× the weight of the inter-day lines — clearly
          visible without looking heavy. Sits on z-10 above child
          borders so hour-row border-b can't chop it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-10"
        style={{
          width: "1.5px",
          backgroundColor: "rgba(60, 60, 67, 0.26)",
        }}
      />
    </div>
  );
}

const TimeColumn = memo(TimeColumnInner);
export default TimeColumn;
export { HOURS };
