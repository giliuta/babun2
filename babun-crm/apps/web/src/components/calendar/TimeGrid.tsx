"use client";

// Full 24-hour grid: 00:00 .. 23:00
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeGridProps {
  hourHeight?: number;
}

export default function TimeGrid({ hourHeight = 60 }: TimeGridProps) {
  return (
    <div className="w-9 lg:w-14 flex-shrink-0 border-r border-[var(--separator)] bg-[var(--surface-grouped)]">
      {/* Spacer matching the day column header — sticks while scrolling */}
      <div className="sticky top-0 z-30 h-[52px] lg:h-[72px] border-b border-[var(--separator)] bg-[var(--surface-grouped)]" />

      {/* Hour labels */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-[var(--separator)] flex items-start justify-end pr-1 lg:pr-2 pt-0"
          style={{ height: `${hourHeight}px` }}
        >
          <span className="text-[12px] lg:text-[12px] text-[var(--label-tertiary)] -mt-1.5 select-none">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

export { HOURS };
