"use client";

import { useEffect, useRef, useState } from "react";

export interface UndoToastProps {
  open: boolean;
  message: string;
  onUndo: () => void;
  onClose: () => void;
  durationMs?: number;
}

// iOS / Telegram undo toast. Dark pill at the bottom of the viewport
// with a primary-coloured "Отменить" action on the right and a slim
// progress bar underneath. Auto-dismisses; caller can force-close via
// onClose. Positioned above the BottomTabBar using `safe-area-inset`
// padding so it never covers the center FAB on phones.
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
      data-testid="undo-toast"
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,380px)]"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 8px) + 80px)",
      }}
    >
      <div className="relative overflow-hidden rounded-[14px] bg-[var(--surface-toast)] text-[var(--label-on-accent)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 text-[14px] leading-snug">{message}</div>
          <button
            type="button"
            onClick={() => {
              onUndo();
              onClose();
            }}
            data-testid="undo-toast-undo-button"
            className="text-[14px] font-semibold text-[var(--system-blue)] active:opacity-60 transition"
          >
            Отменить
          </button>
        </div>
        <div
          className="absolute left-0 bottom-0 h-[2px] bg-[var(--system-blue)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
