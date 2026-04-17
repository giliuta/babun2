"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

interface SwipeableCalendarProps {
  /**
   * Renders the calendar for the given offset (-1 = previous, 0 = current, 1 = next).
   * The wrapper renders three pages side-by-side and lets the user swipe between them.
   */
  renderPage: (offset: -1 | 0 | 1) => React.ReactNode;
  onSwipeLeft: () => void; // user swiped left → next period
  onSwipeRight: () => void; // user swiped right → previous period
}

// Swipe needs to travel at least this fraction of the screen width to commit.
const SWIPE_COMMIT_RATIO = 0.25;
// Below this absolute pixel delta, treat as a tap and ignore.
const SWIPE_MIN_PX = 30;
// Direction lock thresholds (px) — decide horizontal vs vertical scroll.
const DIRECTION_LOCK_PX = 8;

type Direction = "none" | "horizontal" | "vertical";

export default function SwipeableCalendar({
  renderPage,
  onSwipeLeft,
  onSwipeRight,
}: SwipeableCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const directionRef = useRef<Direction>("none");
  const draggingRef = useRef(false);
  const committedDirRef = useRef<-1 | 0 | 1>(0);
  const animatingRef = useRef(false);

  // RAF throttling so touchmove never updates more than once per frame.
  const rafIdRef = useRef<number | null>(null);
  const lastDxRef = useRef(0);

  // Apply translate to the track. Center position = -width.
  const setTrackOffset = (offsetPx: number, withTransition: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = withTransition
      ? "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)"
      : "none";
    track.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
    if (!withTransition) {
      // Force a layout flush so the next transition (if any) starts from the new offset
      // without animating from the previous position.
      void track.offsetHeight;
    }
  };

  const recenter = () => {
    setTrackOffset(-width, false);
  };

  // Measure width on mount and on resize
  useLayoutEffect(() => {
    const measure = () => {
      const w = containerRef.current?.offsetWidth || 0;
      setWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Whenever width changes (or after first measure), center the track
  useEffect(() => {
    const track = trackRef.current;
    if (width > 0 && track) {
      track.style.transition = "none";
      track.style.transform = `translate3d(${-width}px, 0, 0)`;
      void track.offsetHeight;
    }
  }, [width]);

  // Cancel any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (animatingRef.current) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    directionRef.current = "none";
    draggingRef.current = true;
    // Mark track as actively transforming (helps the compositor)
    if (trackRef.current) trackRef.current.style.willChange = "transform";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    // Second finger landed → pinch-zoom in progress, cancel the swipe
    if (e.touches.length > 1) {
      draggingRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setTrackOffset(-width, true);
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (directionRef.current === "none") {
      if (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX) {
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      } else {
        return;
      }
    }

    if (directionRef.current === "vertical") return; // let the page scroll vertically

    // Horizontal: drag the track. Try to prevent vertical scroll.
    if (e.cancelable) e.preventDefault();
    lastDxRef.current = dx;

    // Throttle DOM updates to one per animation frame for buttery scrolling
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setTrackOffset(-width + lastDxRef.current, false);
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    // Apply any pending RAF update synchronously
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (directionRef.current !== "horizontal") {
      directionRef.current = "none";
      return;
    }

    const t = e.changedTouches[0];
    const dx = t.clientX - startXRef.current;
    const ratio = width > 0 ? Math.abs(dx) / width : 0;

    if (Math.abs(dx) >= SWIPE_MIN_PX && ratio >= SWIPE_COMMIT_RATIO) {
      // Commit: animate to next/prev page
      const dir: -1 | 1 = dx < 0 ? -1 : 1;
      committedDirRef.current = dir;
      animatingRef.current = true;
      // dir = +1 means swipe right (going to PREVIOUS page) → translate to 0
      // dir = -1 means swipe left  (going to NEXT page)     → translate to -2*width
      const targetPx = dir === 1 ? 0 : -2 * width;
      setTrackOffset(targetPx, true);
    } else {
      // Snap back
      setTrackOffset(-width, true);
    }
  };

  const handleTransitionEnd = () => {
    if (!animatingRef.current) return;
    const dir = committedDirRef.current;
    animatingRef.current = false;
    committedDirRef.current = 0;

    // Release will-change so the layer can be recycled
    if (trackRef.current) trackRef.current.style.willChange = "auto";

    // Atomically: re-center the track AND notify parent to advance state.
    // flushSync forces the parent re-render to happen synchronously, so the
    // new children appear in the same paint as the recenter — no flicker.
    flushSync(() => {
      // First disable transitions and snap track back to center
      setTrackOffset(-width, false);
      // Then advance the parent state — children swap to new period
      if (dir === -1) onSwipeLeft();
      else if (dir === 1) onSwipeRight();
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 relative"
      style={{
        overflowX: "clip",
        // pan-y allows vertical scroll AND forwards pinch gestures to JS
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {width > 0 && (
        <div
          ref={trackRef}
          className="flex"
          style={{
            width: `${width * 3}px`,
            transform: `translate3d(${-width}px, 0, 0)`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <div
            className="flex flex-col"
            style={{ width: `${width}px`, flexShrink: 0, overflowX: "clip" }}
          >
            {renderPage(-1)}
          </div>
          <div
            className="flex flex-col"
            style={{ width: `${width}px`, flexShrink: 0, overflowX: "clip" }}
          >
            {renderPage(0)}
          </div>
          <div
            className="flex flex-col"
            style={{ width: `${width}px`, flexShrink: 0, overflowX: "clip" }}
          >
            {renderPage(1)}
          </div>
        </div>
      )}
    </div>
  );
}
