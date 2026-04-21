"use client";

import { memo } from "react";

// Standalone time column rendered OUTSIDE the swipeable area, so it stays
// fixed on the left while the user swipes between weeks.
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeColumnInner() {
  return (
    <div className="w-12 lg:w-16 flex-shrink-0 bg-[var(--surface-card)]">
      {/* Header spacer must match DayColumn header exactly, else hour
          labels drift vs the grid rows under pinch-zoom. */}
      <div className="sticky top-0 z-30 h-[72px] lg:h-[82px] border-b border-[var(--separator-opaque)] bg-[var(--surface-card)]" />

      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-[var(--separator)] flex items-start justify-end pr-1.5 lg:pr-2"
          style={{ height: "var(--hh)", boxSizing: "border-box" }}
        >
          <span className="text-[11px] lg:text-[12px] font-medium text-[var(--label-tertiary)] -mt-2 select-none tabular-nums">
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
