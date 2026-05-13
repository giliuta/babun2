"use client";

// v492 — extracted from /dashboard/teams/[id]/cities/page.tsx so the
// personal labels page can share the same row + long-press UX without
// duplicating ~80 lines of touch handling.

import { useRef } from "react";
import { MapPin, Star } from "@babun/shared/icons";
import type { City } from "@babun/shared/local/cities";

// Tap fires on click (gets iOS's built-in movement tolerance for free).
// Long-press fires after 500 ms of stationary press and flags itself
// so the subsequent synthetic click is swallowed.
export function useLongPressOrTap({
  onTap,
  onLongPress,
  delay = 500,
}: {
  onTap: (anchor: { x: number; y: number }) => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  delay?: number;
}) {
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      triggered.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        triggered.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(12);
        }
        if (origin.current) onLongPress(origin.current);
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: React.MouseEvent) => {
      if (triggered.current) {
        e.preventDefault();
        e.stopPropagation();
        triggered.current = false;
        return;
      }
      onTap({ x: e.clientX, y: e.clientY });
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}

interface LabelRowProps {
  city: City;
  isBase: boolean;
  isImplicitBase?: boolean;
  onTap: (anchor: { x: number; y: number }) => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}

export function LabelRow({
  city,
  isBase,
  isImplicitBase,
  onTap,
  onLongPress,
}: LabelRowProps) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const tile = city.color ?? "#8E8E93";
  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[56px] cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        isBase ? "bg-[var(--accent-tint)]" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
        style={{ backgroundColor: tile }}
      >
        <MapPin size={16} strokeWidth={2.2} />
      </span>
      <span
        className={`flex-1 min-w-0 text-[15px] truncate ${
          isBase
            ? "font-semibold text-[var(--accent)]"
            : "text-[var(--label)]"
        }`}
      >
        {city.name}
      </span>
      <span className="w-6 flex items-center justify-end">
        {isBase ? (
          isImplicitBase ? (
            <Star
              size={20}
              strokeWidth={2}
              className="text-[var(--system-yellow)] opacity-70"
            />
          ) : (
            <Star
              size={20}
              strokeWidth={0}
              fill="var(--system-yellow)"
              className="text-[var(--system-yellow)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            />
          )
        ) : null}
      </span>
    </div>
  );
}
