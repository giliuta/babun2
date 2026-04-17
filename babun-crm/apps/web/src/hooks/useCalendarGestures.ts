"use client";

import { useCallback, useEffect } from "react";

// ─── Constants (re-exported so dashboard/page.tsx stays in sync) ──────────

export const HOUR_HEIGHT_MIN = 24;
export const HOUR_HEIGHT_MAX = 480;
export const HOUR_HEIGHT_DEFAULT = 60;
export const HOUR_HEIGHT_STEP = 20;

export function clampHourHeight(h: number): number {
  return Math.max(HOUR_HEIGHT_MIN, Math.min(HOUR_HEIGHT_MAX, h));
}

// ─── Hook ─────────────────────────────────────────────────────────────────

interface UseCalendarGesturesParams {
  outerScrollerRef: React.RefObject<HTMLDivElement | null>;
  hourHeightRef: React.MutableRefObject<number>;
  writeHourHeight: (h: number) => void;
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
}: UseCalendarGesturesParams): UseCalendarGesturesResult {

  // Zoom around the vertical center of the viewport so the same time
  // stays visible. Writes directly to the DOM — no React re-render during
  // motion.
  const zoomBy = useCallback(
    (nextH: number) => {
      const el = outerScrollerRef.current;
      const clamped = clampHourHeight(nextH);
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
    [outerScrollerRef, hourHeightRef, writeHourHeight]
  );

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
      const next = clampHourHeight(pinchStartH * ratio);
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
      const next = clampHourHeight(gestureStartH * scale);
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
      const next = clampHourHeight(hourHeightRef.current * factor);
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
  }, []); // refs are stable — no deps needed

  return { zoomBy, handleZoomIn, handleZoomOut };
}
