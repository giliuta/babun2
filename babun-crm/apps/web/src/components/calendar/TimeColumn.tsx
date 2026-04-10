"use client";

// Standalone time column rendered OUTSIDE the swipeable area, so it stays
// fixed on the left while the user swipes between weeks.

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeColumnProps {
  hourHeight: number;
}

export default function TimeColumn({ hourHeight }: TimeColumnProps) {
  return (
    <div className="w-9 lg:w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50">
      {/* Header spacer (sticks while vertically scrolling) */}
      <div className="sticky top-0 z-30 h-[52px] lg:h-[72px] border-b border-gray-200 bg-gray-50" />

      {/* Hour labels */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-gray-100 flex items-start justify-end pr-1 lg:pr-2"
          style={{ height: `${hourHeight}px` }}
        >
          <span className="text-[9px] lg:text-[11px] text-gray-400 -mt-1.5 select-none">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

export { HOURS };
