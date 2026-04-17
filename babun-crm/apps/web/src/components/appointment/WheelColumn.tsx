"use client";

import { useEffect, useRef } from "react";

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (idx: number) => void;
  width: number;
  itemHeight?: number;
  visibleCount?: number;
}

// iOS-PWA-safe wheel column. Snap is CSS-driven with a JS fallback:
// after 80 ms of scroll inactivity we Math.round scrollTop to the
// nearest row and write it directly (behavior:"smooth" is ignored on
// -webkit-overflow-scrolling:touch layers inside PWAs).
export default function WheelColumn({
  items,
  selectedIndex,
  onChange,
  width,
  itemHeight = 36,
  visibleCount = 3,
}: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  // What we last reported to the parent — guards against re-emitting
  // the same index when the parent syncs `selectedIndex` back to us.
  const lastReported = useRef(selectedIndex);

  const pad = Math.floor(visibleCount / 2);
  const containerH = itemHeight * visibleCount;

  // Initial placement on mount — before any user scroll so the
  // selected item starts inside the selection bar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = selectedIndex * itemHeight;
    lastReported.current = selectedIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External sync: when the parent changes selectedIndex for any
  // reason (e.g. picking a service reset duration), write the new
  // scrollTop directly. Gate on lastReported so we don't thrash.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (lastReported.current === selectedIndex) return;
    el.scrollTop = selectedIndex * itemHeight;
    lastReported.current = selectedIndex;
  }, [selectedIndex, itemHeight]);

  const handleScroll = () => {
    if (snapTimer.current) window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const raw = Math.round(el.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(items.length - 1, raw));
      // Force exact row alignment — iOS momentum can leave us a few px off.
      el.scrollTop = clamped * itemHeight;
      if (clamped !== lastReported.current) {
        lastReported.current = clamped;
        onChange(clamped);
      }
    }, 80);
  };

  return (
    <div className="relative" style={{ width, height: containerH }}>
      {/* selection bar behind items */}
      <div
        className="pointer-events-none absolute inset-x-0 bg-violet-100/80 border border-violet-200 rounded-lg"
        style={{ top: itemHeight * pad, height: itemHeight }}
      />
      {/* top fade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: 28,
          background: "linear-gradient(to bottom, rgb(248 250 252), transparent)",
        }}
      />
      {/* bottom fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: 28,
          background: "linear-gradient(to top, rgb(248 250 252), transparent)",
        }}
      />
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto relative wheel-col-scroll"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "y mandatory",
          // Shift the "snap origin" down by the top pad rows so
          // `scroll-snap-align: start` lines each item up with the
          // selection bar, not with the viewport top. Without this
          // the browser snaps scrollTop to itemHeight on mount and
          // the first visible item in the bar becomes index 1.
          scrollPaddingTop: itemHeight * pad,
          scrollbarWidth: "none",
        }}
      >
        {/* pad top so index 0 can reach the selection bar */}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`top-${i}`} style={{ height: itemHeight }} />
        ))}
        {items.map((label, i) => {
          const active = i === selectedIndex;
          return (
            <div
              key={i}
              className="flex items-center justify-center tabular-nums select-none"
              style={{
                height: itemHeight,
                scrollSnapAlign: "start",
                color: active ? "#4c1d95" : "#94a3b8",
                fontSize: active ? 14 : 12,
                fontWeight: active ? 700 : 500,
              }}
            >
              {label}
            </div>
          );
        })}
        {/* pad bottom so last index can reach the selection bar */}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`bot-${i}`} style={{ height: itemHeight }} />
        ))}
      </div>
    </div>
  );
}
