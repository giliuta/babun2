"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

  // Apply translate to the track. Center position = -width.
  const setTrackOffset = (offsetPx: number, withTransition: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = withTransition ? "transform 250ms ease-out" : "none";
    track.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
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
    if (width > 0) recenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (animatingRef.current) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    directionRef.current = "none";
    draggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
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
    setTrackOffset(-width + dx, false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

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
    if (dir === -1) onSwipeLeft();
    else if (dir === 1) onSwipeRight();
    // Re-center instantly. The state update from onSwipe will swap children
    // so the (now-centered) middle slot shows the new period.
    recenter();
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden touch-pan-y relative"
      style={{ width: 0, minWidth: "100%" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {width > 0 && (
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            width: `${width * 3}px`,
            transform: `translate3d(${-width}px, 0, 0)`,
            willChange: "transform",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{ width: `${width}px`, flexShrink: 0 }}
          >
            {renderPage(-1)}
          </div>
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{ width: `${width}px`, flexShrink: 0 }}
          >
            {renderPage(0)}
          </div>
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{ width: `${width}px`, flexShrink: 0 }}
          >
            {renderPage(1)}
          </div>
        </div>
      )}
    </div>
  );
}
