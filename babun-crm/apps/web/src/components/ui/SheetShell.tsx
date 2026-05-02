"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "@babun/shared/icons";
import { registerModalBack } from "@/lib/history-stack";

interface SheetShellProps {
  open: boolean;
  onClose: () => void;
  /** Title shown in the sticky header. */
  title: ReactNode;
  /** Optional caption shown under the title. */
  subtitle?: ReactNode;
  /** Optional right-aligned header accessory (close button replaced / extra actions). */
  headerAccessory?: ReactNode;
  /** Footer pinned to the bottom (respects safe-area). */
  footer?: ReactNode;
  /** Full sheet height. Defaults to "92vh" to leave space above the tab bar. */
  height?: string;
  /** Max width for desktop. Defaults to `max-w-lg` (512 px). */
  maxWidth?: string;
  children: ReactNode;
}

// Centered modal sheet — the canonical "heavy form" shell used by
// MasterSheet, AppointmentSheet, etc. Rounded 14 px, Telegram-style
// sticky header (bold centered title + graphite close circle),
// grouped-list body scroll, sticky footer with safe-area padding.
// Closes on Escape and backdrop tap. Kept centered (per product
// preference) rather than bottom-slide-up.
export default function SheetShell({
  open,
  onClose,
  title,
  subtitle,
  headerAccessory,
  footer,
  height = "92vh",
  maxWidth = "max-w-lg",
  children,
}: SheetShellProps) {
  const sheetId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    // STORY-053b — register hardware-back handler so Android Back /
    // iOS edge-swipe close the sheet instead of navigating away.
    const popClose = registerModalBack(`sheet:${sheetId}`, onClose);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      // popClose is a no-op if the user already triggered hardware back,
      // otherwise it balances our pushState entry.
      popClose();
    };
  }, [open, onClose, sheetId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] p-2 animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[var(--surface-card)] rounded-[var(--radius-sheet)] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden animate-sheet-up`}
        style={{ height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 pt-3.5 pb-3 flex items-center gap-3 border-b border-[var(--separator)] bg-[var(--surface-card)]">
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold text-[var(--label)] truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[13px] text-[var(--label-secondary)] truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerAccessory}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="w-8 h-8 rounded-full bg-[var(--fill-primary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center transition"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
          {children}
        </div>
        {footer && (
          <div
            className="flex-shrink-0 px-4 py-3 border-t border-[var(--separator)] bg-[var(--surface-card)]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 12px)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
