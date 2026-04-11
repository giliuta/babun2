"use client";

import { useRef, useState, type ReactNode } from "react";

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string; // tailwind bg colour, e.g. "bg-emerald-500"
  onSelect: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  leftActions?: SwipeAction[]; // revealed on swipe-right
  rightActions?: SwipeAction[]; // revealed on swipe-left
  threshold?: number;
}

// Swipeable list row. Drag the content horizontally to reveal a column
// of quick-action buttons on either side. Snaps fully open when dragged
// past `threshold` and closes on outside click or when an action fires.
export default function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 60,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const leftWidth = leftActions.length * 72;
  const rightWidth = rightActions.length * 72;

  const clamp = (v: number) =>
    Math.max(-rightWidth, Math.min(leftWidth, v));

  const handleStart = (clientX: number) => {
    startX.current = clientX;
    startOffset.current = offset;
  };

  const handleMove = (clientX: number) => {
    if (startX.current === null) return;
    const delta = clientX - startX.current;
    setOffset(clamp(startOffset.current + delta));
  };

  const handleEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (offset > threshold) {
      setOffset(leftWidth);
    } else if (offset < -threshold) {
      setOffset(-rightWidth);
    } else {
      setOffset(0);
    }
  };

  const close = () => setOffset(0);

  return (
    <div className="relative overflow-hidden">
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex">
          {leftActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onSelect();
                close();
              }}
              className={`w-[72px] flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium ${a.color}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {rightActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onSelect();
                close();
              }}
              className={`w-[72px] flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium ${a.color}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative bg-white transition-transform touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transitionDuration: startX.current === null ? "200ms" : "0ms",
        }}
        onPointerDown={(e) => handleStart(e.clientX)}
        onPointerMove={(e) => handleMove(e.clientX)}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onClick={() => {
          if (offset !== 0) {
            close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
