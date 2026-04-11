"use client";

import { memo } from "react";

// Standalone time column rendered OUTSIDE the swipeable area, so it stays
// fixed on the left while the user swipes between weeks.
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeColumnInner() {
  return (
    <div className="w-9 lg:w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50">
      {/* Header spacer (sticks while vertically scrolling) */}
      <div className="sticky top-0 z-30 h-[52px] lg:h-[72px] border-b border-gray-200 bg-gray-50" />

      {/* Hour labels — height follows the live --hh variable so zoom does
          not trigger React re-renders. */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-gray-200 flex items-start justify-end pr-1 lg:pr-2"
          style={{ height: "var(--hh)" }}
        >
          <span className="text-[9px] lg:text-[11px] text-gray-400 -mt-1.5 select-none">
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
