"use client";

import { memo } from "react";

// Standalone time column rendered OUTSIDE the swipeable area, so it stays
// fixed on the left while the user swipes between weeks.
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeColumnInner() {
  return (
    <div className="w-12 lg:w-16 flex-shrink-0 bg-white" style={{ borderRight: "2px solid #9ca3af" }}>
      {/* Header spacer — ОБЯЗАН совпадать по высоте с DayColumn header,
          иначе строки часов съезжают относительно лейблов на (diff)px
          и при pinch-zoom зона рассинхрона растёт визуально. */}
      <div className="sticky top-0 z-30 h-[72px] lg:h-[82px] border-b border-gray-300 bg-white" />

      {/* Hour labels — height follows the live --hh variable so zoom does
          not trigger React re-renders. border-box sizing includes the
          1-px bottom border, точно как у grid-линий в DayColumn через
          repeating-linear-gradient: соседние ячейки выровнены pixel-to-pixel.
          box-sizing явно прописан, чтобы не зависеть от Tailwind preflight. */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-gray-200 flex items-start justify-end pr-1.5 lg:pr-2"
          style={{ height: "var(--hh)", boxSizing: "border-box" }}
        >
          <span className="text-[11px] lg:text-[12px] font-medium text-gray-500 -mt-2 select-none tabular-nums">
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
