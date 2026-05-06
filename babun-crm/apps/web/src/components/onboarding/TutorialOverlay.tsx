"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Hydration + DOM-measurement effects feed React state from external
// observation (matchMedia, getBoundingClientRect). Same exception
// pattern as CsvImportHint / CalendarEmptyState / SplashScreen.

// STORY-059 — single-step tutorial overlay.
//
// Reads the bounding rect of an element with `[data-tutorial="<id>"]`,
// renders a backdrop with a cutout around it, and a tooltip card
// pointing at the cutout. Tapping the highlighted element OR the
// "Понятно" button completes the tutorial (writes the localStorage
// flag and unmounts).
//
// Geometry strategy — backdrop is a single fixed div whose `clipPath`
// is a polygon with the target rect punched out. Pure CSS, no SVG
// masking, no double-render. Recomputes on resize and on
// scroll/orientation change since the target may shift.
//
// Accessibility:
//   * prefers-reduced-motion: skip the fade-in, render at full
//     opacity immediately. The tooltip still appears (it's the
//     useful part), just without easing.
//   * aria-live for the tooltip text so screen readers announce.
//   * Tab to the "Понятно" button is the only focusable element
//     while the overlay is up.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** data-tutorial attribute value to anchor to. */
  targetId: string;
  /** Tooltip body — short, single-sentence guidance. */
  text: string;
  /** Tooltip dismiss-button label. Defaults to "Понятно". */
  ctaLabel?: string;
  /** Called when the user dismisses (button OR target tap). The
   *  parent should call useTutorialState().complete() here. */
  onDismiss: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

export function TutorialOverlay({
  targetId,
  text,
  ctaLabel = "Понятно",
  onDismiss,
}: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const ctaRef = useRef<HTMLButtonElement | null>(null);

  // Measure the target element once it's in the DOM, then on
  // window resize / orientation change. Polls briefly on first
  // mount in case the target is mounted asynchronously.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const measure = () => {
      const el = document.querySelector(
        `[data-tutorial="${targetId}"]`,
      ) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
      return true;
    };

    if (!measure()) {
      // Target not ready yet — poll for ~1s.
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        if (measure() || attempts > 10) window.clearInterval(id);
      }, 100);
      return () => window.clearInterval(id);
    }

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    document.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.removeEventListener("scroll", measure, true);
    };
  }, [targetId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // Click-through capture on the backdrop — tapping the highlighted
  // element should let the tap pass through AND complete the tutorial.
  const onBackdropClick = (e: React.MouseEvent) => {
    if (!rect) {
      onDismiss();
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const inside =
      x >= rect.left &&
      x <= rect.left + rect.width &&
      y >= rect.top &&
      y <= rect.top + rect.height;
    if (inside) {
      // Don't preventDefault — let the underlying element receive
      // the click after we close ourselves. The page handler runs
      // on the next event loop tick because we'll be unmounted.
      onDismiss();
    } else {
      // Outside = also dismiss; matches iOS popover semantics.
      onDismiss();
    }
  };

  // Once measured, focus the CTA so keyboard users can dismiss with
  // Enter without hunting for it.
  useEffect(() => {
    if (rect) ctaRef.current?.focus();
  }, [rect]);

  if (!rect) return null;

  // Position the tooltip BELOW the target if there's room, otherwise
  // above. Center horizontally on the target, clamp to viewport.
  const tooltipWidth = 280;
  const margin = 12;
  const screenW = typeof window !== "undefined" ? window.innerWidth : 360;
  const screenH = typeof window !== "undefined" ? window.innerHeight : 720;
  const tooltipLeft = Math.min(
    Math.max(margin, rect.left + rect.width / 2 - tooltipWidth / 2),
    screenW - tooltipWidth - margin,
  );
  const placeBelow = rect.top + rect.height + 100 < screenH;
  const tooltipTop = placeBelow
    ? rect.top + rect.height + 12
    : Math.max(margin, rect.top - 100 - 12);

  // Backdrop with rectangular cutout via clip-path polygon.
  // Polygon: outer rect viewport - inner rect target.
  const sw = screenW;
  const sh = screenH;
  const tx = rect.left;
  const ty = rect.top;
  const tw = rect.width;
  const th = rect.height;
  const clipPath = `polygon(
    0 0,
    100% 0,
    100% 100%,
    0 100%,
    0 ${ty}px,
    ${tx}px ${ty}px,
    ${tx}px ${ty + th}px,
    ${tx + tw}px ${ty + th}px,
    ${tx + tw}px ${ty}px,
    0 ${ty}px
  )`;
  void sw;
  void sh;

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    clipPath,
    WebkitClipPath: clipPath,
    zIndex: 90,
    transition: reducedMotion ? "none" : "opacity 200ms",
    opacity: 1,
  };

  return (
    <>
      <div style={backdropStyle} onClick={onBackdropClick} />
      {/* Cutout glow — outline the target with a soft ring. Sits
          above the backdrop's punched hole at the same z-index. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: 14,
          boxShadow: "0 0 0 3px rgba(62,136,247,0.85)",
          zIndex: 91,
          pointerEvents: "none",
        }}
      />
      <div
        role="dialog"
        aria-live="polite"
        aria-modal="true"
        style={{
          position: "fixed",
          left: tooltipLeft,
          top: tooltipTop,
          width: tooltipWidth,
          zIndex: 92,
        }}
        className="bg-[var(--surface-card)] rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] p-4"
      >
        <div className="text-[14px] leading-snug text-[var(--label)]">
          {text}
        </div>
        <button
          ref={ctaRef}
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full h-10 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale"
        >
          {ctaLabel}
        </button>
      </div>
    </>
  );
}
