"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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

// Centered modal sheet — the canonical "heavy form" shell used for
// MasterSheet, AppointmentSheet, etc. Backdrop blur, rounded 20-px
// shell, sticky header + body + footer. Closes on Escape and on
// backdrop tap. Body scrolls; header and footer stay fixed.
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden`}
        style={{ height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-[var(--separator)]">
          <div className="min-w-0">
            <div className="text-[17px] font-semibold text-[var(--label)] truncate tracking-tight">
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
              className="w-8 h-8 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center transition"
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
