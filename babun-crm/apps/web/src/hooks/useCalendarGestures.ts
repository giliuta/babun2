"use client";

import { useCallback, useEffect, useRef } from "react";

// ─── Constants (re-exported so dashboard/page.tsx stays in sync) ──────────

export const HOUR_HEIGHT_MIN = 24;
export const HOUR_HEIGHT_MAX = 480;
export const HOUR_HEIGHT_DEFAULT = 60;
export const HOUR_HEIGHT_STEP = 20;

// v473 — header above the grid (sticky day-header + time-column label).
// Used to compute the dynamic viewport floor so the grid fills the
// scroller even at the lowest zoom level.
const GRID_HEADER_PX = 72;

export function clampHourHeight(h: number, floor = HOUR_HEIGHT_MIN): number {
  const effectiveMin = Math.max(HOUR_HEIGHT_MIN, floor);
  return Math.max(effectiveMin, Math.min(HOUR_HEIGHT_MAX, h));
}

// ─── Hook ─────────────────────────────────────────────────────────────────

interface UseCalendarGesturesParams {
  outerScrollerRef: React.RefObject<HTMLDivElement | null>;
  hourHeightRef: React.MutableRefObject<number>;
  writeHourHeight: (h: number) => void;
  /** v473 — number of hours visible in the calendar window. Drives a
   *  dynamic min hour-height so pinch-zoom-out can't shrink the grid
   *  below the viewport (no empty gap under 23:59). */
  windowDurationHours: number;
  /** True only while the scroller element is actually mounted (week /
   *  day views). Month + agenda views unmount the scroller, so its DOM
   *  node — and any listeners bound to it — is destroyed. When the user
   *  returns to week/day a NEW node is mounted; this flag re-runs the
   *  listener-attach effects so pinch-zoom keeps working after switching
   *  views (month → list → week was leaving zoom dead). */
  gridActive: boolean;
}

interface UseCalendarGesturesResult {
  zoomBy: (nextH: number) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
}

export function useCalendarGestures({
  outerScrollerRef,
  hourHeightRef,
  writeHourHeight,
  windowDurationHours,
  gridActive,
}: UseCalendarGesturesParams): UseCalendarGesturesResult {

  // v473 — viewport-aware floor for --hh. The grid body height is
  // `--hh * windowDurationHours`; if it ever falls below the scroller's
  // viewport minus header, an empty gap appears under 23:59 («пропуск
  // внизу при уменьшении»). Recompute live so orientation/keyboard/
  // viewport changes flow through automatically.
  const windowHoursRef = useRef(windowDurationHours);
  windowHoursRef.current = windowDurationHours;

  const getViewportFloor = useCallback((): number => {
    const el = outerScrollerRef.current;
    const wh = windowHoursRef.current;
    if (!el || wh <= 0) return HOUR_HEIGHT_MIN;
    const usable = Math.max(0, el.clientHeight - GRID_HEADER_PX);
    return usable / wh;
  }, [outerScrollerRef]);

  // Zoom around the vertical center of the viewport so the same time
  // stays visible. Writes directly to the DOM — no React re-render during
  // motion.
  const zoomBy = useCallback(
    (nextH: number) => {
      const el = outerScrollerRef.current;
      const clamped = clampHourHeight(nextH, getViewportFloor());
      const prev = hourHeightRef.current;
      if (clamped === prev) return;
      let nextScroll: number | null = null;
      if (el) {
        const focusY = el.clientHeight / 2;
        const anchor = (el.scrollTop + focusY) / prev;
        nextScroll = anchor * clamped - focusY;
      }
      writeHourHeight(clamped);
      if (el && nextScroll !== null) {
        requestAnimationFrame(() => {
          if (outerScrollerRef.current) {
            outerScrollerRef.current.scrollTop = nextScroll!;
          }
        });
      }
    },
    [outerScrollerRef, hourHeightRef, writeHourHeight, getViewportFloor]
  );

  // v473 — re-clamp on viewport / window-duration changes (orientation
  // flip, switch to day/3-day view, brigade with smaller hour window).
  // Without this, a previous pinch-out HH can leave the grid shorter
  // than the new viewport, re-introducing the bottom gap.
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;
    const reclamp = () => {
      const clamped = clampHourHeight(hourHeightRef.current, getViewportFloor());
      if (Math.abs(clamped - hourHeightRef.current) > 0.5) {
        writeHourHeight(clamped);
      }
    };
    reclamp();
    const ro = new ResizeObserver(reclamp);
    ro.observe(el);
    window.addEventListener("orientationchange", reclamp);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", reclamp);
    };
  }, [
    outerScrollerRef,
    hourHeightRef,
    writeHourHeight,
    getViewportFloor,
    windowDurationHours,
    // Re-attach the ResizeObserver to the freshly-mounted scroller when
    // returning to week/day from month/agenda.
    gridActive,
  ]);

  const handleZoomIn = useCallback(
    () => zoomBy(hourHeightRef.current + HOUR_HEIGHT_STEP),
    [zoomBy, hourHeightRef]
  );

  const handleZoomOut = useCallback(
    () => zoomBy(hourHeightRef.current - HOUR_HEIGHT_STEP),
    [zoomBy, hourHeightRef]
  );

  // ─── Pinch-to-zoom (touch) + Ctrl+wheel (desktop) ────────────────────
  // Uses THREE input sources for maximum browser coverage:
  //  1. touchstart/touchmove (Android Chrome)
  //  2. gesturestart/gesturechange (iOS Safari — non-standard but required)
  //  3. wheel with ctrl/meta key (desktop trackpad pinch + ctrl+scroll)
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;

    let pinchStartDist = 0;
    let pinchStartH = hourHeightRef.current;
    let pinchMidY = 0;
    let pinchStartScroll = 0;
    let pinchActive = false;

    const distance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const applyZoom = (next: number, focusY: number, anchor: number) => {
      if (Math.abs(next - hourHeightRef.current) < 0.5) return;
      writeHourHeight(next);
      const scroller = outerScrollerRef.current;
      if (scroller) scroller.scrollTop = anchor * next - focusY;
    };

    // ── Standard multi-touch (Android / Chrome) ───────────────────────
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        pinchActive = true;
        pinchStartDist = distance(t0, t1);
        pinchStartH = hourHeightRef.current;
        const rect = el.getBoundingClientRect();
        pinchMidY = (t0.clientY + t1.clientY) / 2 - rect.top;
        pinchStartScroll = el.scrollTop;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinchActive || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      const d = distance(e.touches[0], e.touches[1]);
      if (pinchStartDist <= 0) return;
      const ratio = d / pinchStartDist;
      const next = clampHourHeight(pinchStartH * ratio, getViewportFloor());
      const anchor = (pinchStartScroll + pinchMidY) / pinchStartH;
      applyZoom(next, pinchMidY, anchor);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchActive = false;
    };

    // ── iOS Safari gesture events (non-standard but only way for pinch) ─
    let gestureStartH = hourHeightRef.current;
    let gestureStartScroll = 0;
    let gestureMidY = 0;

    const onGestureStart = (e: Event) => {
      const ge = e as Event & { scale?: number; clientY?: number };
      e.preventDefault();
      gestureStartH = hourHeightRef.current;
      gestureStartScroll = el.scrollTop;
      const rect = el.getBoundingClientRect();
      gestureMidY = (ge.clientY ?? rect.top + rect.height / 2) - rect.top;
    };

    const onGestureChange = (e: Event) => {
      const ge = e as Event & { scale?: number };
      e.preventDefault();
      const scale = ge.scale ?? 1;
      const next = clampHourHeight(gestureStartH * scale, getViewportFloor());
      const anchor = (gestureStartScroll + gestureMidY) / gestureStartH;
      applyZoom(next, gestureMidY, anchor);
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    // ── Desktop wheel (ctrl/meta modifier for trackpad pinch or ctrl+scroll) ─
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.005);
      const next = clampHourHeight(
        hourHeightRef.current * factor,
        getViewportFloor(),
      );
      const rect = el.getBoundingClientRect();
      const focusY = e.clientY - rect.top;
      const anchor = (el.scrollTop + focusY) / hourHeightRef.current;
      applyZoom(next, focusY, anchor);
    };

    // iOS Safari handles pinch via gesturestart/gesturechange, so we
    // can keep touchmove passive there and let the browser scroll at
    // 120 Hz. Android Chrome (and desktop Chrome with touch) needs
    // non-passive touchmove to intercept the pinch.
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: isIOS ? true : false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("gesturestart", onGestureStart as EventListener);
    el.addEventListener("gesturechange", onGestureChange as EventListener);
    el.addEventListener("gestureend", onGestureEnd as EventListener);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("gesturestart", onGestureStart as EventListener);
      el.removeEventListener("gesturechange", onGestureChange as EventListener);
      el.removeEventListener("gestureend", onGestureEnd as EventListener);
      el.removeEventListener("wheel", onWheel);
    };
    // `gridActive` is the re-attach trigger: the scroller node is
    // destroyed when switching to month/agenda and a NEW node is mounted
    // on returning to week/day. Without this dep the effect ran once and
    // left the new node with no pinch/gesture/wheel listeners → zoom dead
    // after month → list → week. The other inputs are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridActive]);

  return { zoomBy, handleZoomIn, handleZoomOut };
}
