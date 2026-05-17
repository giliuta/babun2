"use client";

/**
 * useBodyScrollLock — lock the document body's scroll while a modal
 * is open + wire Esc to close. Restores the previous overflow on
 * cleanup so nested modals can stack their locks.
 *
 * The `target` switch chooses which element to clamp:
 *   • "body" — sufficient for top-level modals (covers the window
 *     scroll). The default.
 *   • "html" — additionally clamps documentElement; needed for
 *     nested popups over a modal with its own internal
 *     overflow-y-auto scroller (e.g. AppointmentSheet's body scroll
 *     can still pan behind a z-92 popup on iOS Safari without
 *     this).
 *
 * Extracted from AppointmentSheet (Sprint #4 §9 step 7, v628).
 */

import { useEffect } from "react";

interface UseBodyScrollLockArgs {
  open: boolean;
  onEsc?: () => void;
  target?: "body" | "html";
}

export function useBodyScrollLock({
  open,
  onEsc,
  target = "body",
}: UseBodyScrollLockArgs): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc?.();
    };
    const el = target === "html" ? document.documentElement : document.body;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      el.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onEsc, target]);
}
