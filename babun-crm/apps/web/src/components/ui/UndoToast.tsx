"use client";

import { useEffect, useRef, useState } from "react";

export interface UndoToastProps {
  open: boolean;
  message: string;
  onUndo: () => void;
  onClose: () => void;
  durationMs?: number;
}

// Simple bottom toast with an Undo action. Auto-dismisses after
// durationMs (default 5s) and lets the caller cancel by calling onClose.
// Tapping "Отменить" triggers onUndo and closes. Rendered in a fixed
// wrapper so it floats above the whole app without needing a portal.
export default function UndoToast({
  open,
  message,
  onUndo,
  onClose,
  durationMs = 5000,
}: UndoToastProps) {
  const timerRef = useRef<number | null>(null);
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    if (!open) return;
    setRemaining(durationMs);
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const left = durationMs - elapsed;
      if (left <= 0) {
        window.clearInterval(id);
        onClose();
      } else {
        setRemaining(left);
      }
    }, 100);
    timerRef.current = id;
    return () => {
      window.clearInterval(id);
      timerRef.current = null;
    };
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const pct = Math.max(0, Math.min(100, (remaining / durationMs) * 100));

  return (
    <div
      role="status"
      className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[60] w-[min(92vw,380px)]"
    >
      <div className="relative overflow-hidden rounded-xl bg-gray-900 text-white shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 text-[13px] leading-snug">{message}</div>
          <button
            type="button"
            onClick={() => {
              onUndo();
              onClose();
            }}
            className="text-[13px] font-semibold text-amber-300 active:scale-95 transition"
          >
            Отменить
          </button>
        </div>
        <div
          className="absolute left-0 bottom-0 h-[2px] bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
