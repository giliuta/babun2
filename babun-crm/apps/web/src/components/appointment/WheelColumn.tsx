"use client";

import { useEffect, useRef } from "react";

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (idx: number) => void;
  width?: number;
  itemHeight?: number;
  visibleRows?: number;
  /** Infinite-loop mode: tripled list, scrollTop wraps back to the
   *  middle copy on boundary so values flow continuously in both
   *  directions. Default true — the common case (hours, minutes). */
  loop?: boolean;
}

// STORY-009 iOS-style wheel column. Three copies of the items
// stacked vertically; the visible viewport normally sits over the
// middle copy, and scrollTop silently wraps back to the middle the
// moment the user pushes past a boundary. `scroll-snap-align: center`
// plus a small debounce produces the native "tick-and-stop" feel.
//
// Visual selection is two thin lines at the top/bottom of the centre
// row (drawn by the parent TimeBlock); items inside the row scale up
// and darken via the isSelected style. Fade edges come from mask-image
// — no overlaid white rectangles. Scrollbar hidden platform-wide.
export default function WheelColumn({
  items,
  selectedIndex,
  onChange,
  width = 44,
  itemHeight = 34,
  visibleRows = 5,
  loop = true,
}: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  // `ignoreScrollRef` suppresses the scroll handler while we perform
  // a programmatic scrollTop write (initial placement, boundary wrap,
  // post-snap recenter). Without this each write kicks off another
  // debounce cycle and onChange can fire in circles.
  const ignoreScrollRef = useRef(false);
  const lastReportedRef = useRef(selectedIndex);

  const N = items.length;
  const pad = (visibleRows * itemHeight - itemHeight) / 2;
  const viewportH = visibleRows * itemHeight;
  const renderList = loop ? [...items, ...items, ...items] : items;

  // scrollTop that centres `idx` in the viewport. For loop mode we
  // always anchor in the middle copy so the user has a full N items
  // of travel in either direction before we need to wrap.
  const targetScrollTopFor = (idx: number) =>
    (loop ? N + idx : idx) * itemHeight;

  // Initial placement on mount.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    ignoreScrollRef.current = true;
    el.scrollTop = targetScrollTopFor(selectedIndex);
    lastReportedRef.current = selectedIndex;
    requestAnimationFrame(() => {
      ignoreScrollRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External sync: when the parent changes selectedIndex for a reason
  // we didn't emit (e.g. service-preset reset duration), scroll back
  // to the new position.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (lastReportedRef.current === selectedIndex) return;
    ignoreScrollRef.current = true;
    el.scrollTop = targetScrollTopFor(selectedIndex);
    lastReportedRef.current = selectedIndex;
    requestAnimationFrame(() => {
      ignoreScrollRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, itemHeight, N]);

  const handleScroll = () => {
    if (ignoreScrollRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;

    // Immediate boundary wrap. The threshold is halfway through the
    // outer copies so there's always plenty of runway for the iOS
    // inertial tail; without this a fast flick crosses into a real
    // edge and snaps to a clamped scrollTop instead of wrapping.
    if (loop) {
      const copy = N * itemHeight;
      if (el.scrollTop < copy * 0.5) {
        ignoreScrollRef.current = true;
        el.scrollTop += copy;
        requestAnimationFrame(() => {
          ignoreScrollRef.current = false;
        });
      } else if (el.scrollTop > copy * 2.5) {
        ignoreScrollRef.current = true;
        el.scrollTop -= copy;
        requestAnimationFrame(() => {
          ignoreScrollRef.current = false;
        });
      }
    }

    if (snapTimer.current) window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const el2 = scrollerRef.current;
      if (!el2) return;
      const raw = Math.round(el2.scrollTop / itemHeight);
      const normalized = loop
        ? ((raw % N) + N) % N
        : Math.max(0, Math.min(N - 1, raw));
      const target = targetScrollTopFor(normalized);
      if (Math.abs(el2.scrollTop - target) > 0.5) {
        ignoreScrollRef.current = true;
        el2.scrollTop = target;
        requestAnimationFrame(() => {
          ignoreScrollRef.current = false;
        });
      }
      if (normalized !== lastReportedRef.current) {
        lastReportedRef.current = normalized;
        onChange(normalized);
      }
    }, 120);
  };

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="wheel-col-scroll relative"
      style={{
        width,
        height: viewportH,
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        scrollPaddingBlock: pad,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
      }}
    >
      <div style={{ height: pad }} />
      {renderList.map((label, i) => {
        const originalIdx = i % N;
        const active = originalIdx === selectedIndex;
        return (
          <div
            key={i}
            style={{
              height: itemHeight,
              scrollSnapAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums",
              color: active ? "rgb(15 23 42)" : "rgb(148 163 184)",
              fontWeight: active ? 700 : 500,
              fontSize: active ? 22 : 19,
              transition:
                "color 150ms ease-out, font-weight 150ms ease-out, font-size 150ms ease-out",
              userSelect: "none",
            }}
          >
            {label}
          </div>
        );
      })}
      <div style={{ height: pad }} />
    </div>
  );
}
