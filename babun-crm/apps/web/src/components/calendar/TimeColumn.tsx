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
    // Sprint 033 Phase I17 — vertical separator moved from an absolutely-
    // positioned sibling (left-12, w-[2px]) to a native border-right on
    // this column. Reason: the absolute line was decoupled from TimeColumn
    // width and drifted visibly during iOS pinch-zoom at non-integer
    // hour-height values. Now the line is physically part of TimeColumn
    // and can't shift relative to it.
    <div className="w-12 lg:w-16 flex-shrink-0 bg-[var(--surface-card)] border-r border-[var(--separator-opaque)]">
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
    </div>
  );
}

const TimeColumn = memo(TimeColumnInner);
export default TimeColumn;
export { HOURS };
