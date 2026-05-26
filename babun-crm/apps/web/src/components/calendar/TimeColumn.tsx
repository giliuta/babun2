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
    // The time/grid divider is NOT drawn here. Every in-column attempt
    // moved with the scroll/zoom:
    //  · border-right on this (scrolling) column, or an absolute line
    //    inside it → the line + the sticky header corner lifted together
    //    during pinch-zoom (applyZoom writes scrollTop while --hh changes
    //    and `sticky` doesn't hold inside the composited scroller).
    // Fix: the divider AND the top-left corner mask now live as FIXED
    // overlays in the non-scrolling wrapper around the scroller (see
    // dashboard/page.tsx). They sit outside the scroll content, so they
    // can't drift on scroll or lift on zoom. Here we only render the
    // scrolling hour labels; the header spacer keeps the label rows
    // aligned with the day grid below the headers.
    <div className="w-12 lg:w-16 flex-shrink-0 bg-[var(--surface-card)]">
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
