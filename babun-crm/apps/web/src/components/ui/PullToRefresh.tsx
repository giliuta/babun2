"use client";

// STORY-053b — pull-to-refresh wrapper.
//
// Wraps a scrollable list. When the user is at scrollTop=0 and pulls
// downward past the threshold, fires `onRefresh()`. Designed to feel
// at home next to native iOS / Android lists.
//
// Implementation: raw touch/pointer events, no library. The
// indicator translates with the user's drag (sub-linear, max 80 px)
// while at scrollTop 0; once they release past 56 px, it commits to a
// "refreshing" pose, holds while the awaited callback resolves, then
// snaps back. If `onRefresh` throws or rejects, we still snap back —
// the error is the caller's problem.
//
// The indicator stays inert when:
//   - scrollTop > 0 (regular page scroll)
//   - movement starts horizontal (likely intended for SwipeableRow —
//     the dominant horizontal/vertical detection happens in the first
//     5 px of motion)
//
// Light haptic on threshold-crossing. Success haptic on commit.

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { haptic } from "@/lib/haptics";

interface PullToRefreshProps {
  children: ReactNode;
  /** Async callback. The indicator stays "refreshing" until the
   *  returned promise settles (success or rejection). */
  onRefresh: () => Promise<void> | void;
  /** Extra className for the outer wrapper. */
  className?: string;
  /** Threshold in pixels above which a release commits the refresh.
   *  Default 56 — feels native. */
  threshold?: number;
}

type Phase = "idle" | "pulling" | "armed" | "refreshing";

const MAX_PULL = 80;
const PIVOT = 5; // px of motion before we decide horizontal vs vertical

export default function PullToRefresh({
  children,
  onRefresh,
  className,
  threshold = 56,
}: PullToRefreshProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const lockedAxis = useRef<"v" | "h" | null>(null);

  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const lastArmed = useRef(false);

  // Reset pull on phase change to "idle" / "refreshing" without
  // animation while user is dragging; CSS transition handles release.
  useEffect(() => {
    if (phase === "idle") setPull(0);
    if (phase === "refreshing") setPull(threshold);
  }, [phase, threshold]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase === "refreshing") return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (wrapper.scrollTop > 0) return; // not at top — let native scroll
    startY.current = e.clientY;
    startX.current = e.clientX;
    lockedAxis.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null || startX.current === null) return;
    if (phase === "refreshing") return;

    const dy = e.clientY - startY.current;
    const dx = e.clientX - startX.current;

    if (lockedAxis.current === null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < PIVOT && ady < PIVOT) return;
      lockedAxis.current = ady > adx ? "v" : "h";
      if (lockedAxis.current === "h") {
        // user is swiping a row, not pulling
        startY.current = null;
        startX.current = null;
        return;
      }
    }
    if (dy <= 0) return; // ignoring upward drags

    // Sublinear curve — feels rubbery instead of 1:1.
    const eased = Math.min(MAX_PULL, dy * 0.5);
    setPull(eased);

    const armed = eased >= threshold;
    if (armed && !lastArmed.current) {
      haptic("light");
    }
    lastArmed.current = armed;
    setPhase(armed ? "armed" : "pulling");
  };

  const onPointerEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    startX.current = null;
    const wasArmed = phase === "armed";
    lockedAxis.current = null;
    lastArmed.current = false;

    if (!wasArmed) {
      setPhase("idle");
      return;
    }

    setPhase("refreshing");
    haptic("success");
    try {
      await Promise.resolve(onRefresh());
    } catch {
      // swallow — caller should toast their own error.
    } finally {
      setPhase("idle");
    }
  };

  // Inline styles — transform on the inner stack, not on the scroll
  // container, so the actual scrolling target's scrollTop stays 0.
  const refreshing = phase === "refreshing";
  const dragging = phase === "pulling" || phase === "armed";

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className ?? ""}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* Indicator — appears in the gap created by the inner translate */}
      <div
        aria-hidden
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{
          top: -28,
          height: 56,
          opacity: refreshing || dragging ? Math.min(1, pull / threshold) : 0,
          transform: `translateY(${refreshing ? threshold : pull}px)`,
          transitionProperty: "opacity, transform",
          transitionDuration: dragging ? "0ms" : "200ms",
        }}
      >
        <div
          className={`w-8 h-8 rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)] ${
            refreshing ? "babun-spin" : ""
          }`}
          style={{
            transform: refreshing
              ? undefined
              : `rotate(${Math.min(360, (pull / threshold) * 360)}deg)`,
          }}
        />
      </div>

      <div
        style={{
          transform: `translateY(${refreshing ? threshold : pull}px)`,
          transitionProperty: "transform",
          transitionDuration: dragging ? "0ms" : "200ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}
