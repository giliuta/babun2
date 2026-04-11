"use client";

import { useEffect, useRef } from "react";

interface WheelPickerProps {
  values: (string | number)[];
  selectedIndex: number;
  onChange: (index: number) => void;
  itemHeight?: number;
  visibleCount?: number;
  width?: string;
  className?: string;
}

// Classic iOS-style wheel picker built on CSS scroll-snap. A scrollable
// column of items where the centered one is "selected". Snapping happens
// after the user lifts their finger, and onChange fires with the nearest
// index.
export default function WheelPicker({
  values,
  selectedIndex,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  width = "auto",
  className = "",
}: WheelPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number | null>(null);
  const halfCount = Math.floor(visibleCount / 2);

  // When the caller sets selectedIndex programmatically, jump the scroll
  // container to the matching offset without animation.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * itemHeight;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const handleScroll = () => {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      if (clamped !== selectedIndex) onChange(clamped);
    }, 90);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: itemHeight * visibleCount, width }}
    >
      {/* Center highlight lines */}
      <div
        className="absolute left-0 right-0 pointer-events-none border-y-2 border-indigo-200"
        style={{ top: itemHeight * halfCount, height: itemHeight }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: itemHeight * halfCount,
          paddingBottom: itemHeight * halfCount,
          scrollbarWidth: "none",
        }}
      >
        {values.map((v, i) => {
          const distance = Math.abs(i - selectedIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.2;
          const weight = distance === 0 ? "600" : "400";
          return (
            <div
              key={i}
              className="flex items-center justify-center text-center text-gray-900 tabular-nums select-none"
              style={{
                height: itemHeight,
                scrollSnapAlign: "center",
                scrollSnapStop: "always",
                opacity,
                fontWeight: weight,
                fontSize: distance === 0 ? "18px" : "16px",
                transition: "opacity 0.15s, font-size 0.15s",
              }}
            >
              {v}
            </div>
          );
        })}
      </div>
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
