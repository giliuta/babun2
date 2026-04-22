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

      {visibleHours.map((hour) => (
        <div
          key={hour}
          className="border-b border-[var(--separator)] flex items-start justify-end pr-1.5 lg:pr-2"
          style={{ height: "var(--hh)", boxSizing: "border-box" }}
        >
          <span className="text-[12px] lg:text-[12px] font-medium text-[var(--label-tertiary)] -mt-2 select-none tabular-nums">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}

      {/* The separator itself. 1 device pixel, spans the full height
          of the column, sits on top of any child borders. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-0 bg-[var(--separator-opaque)] z-10"
        style={{ width: "0.5px" }}
      />
    </div>
  );
}

const TimeColumn = memo(TimeColumnInner);
export default TimeColumn;
export { HOURS };
