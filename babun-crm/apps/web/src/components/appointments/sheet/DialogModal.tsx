"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface DialogModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// Centered popup dialog with a dark backdrop. The background form is still
// visible through the overlay. Dismiss via the X button, Esc, or tapping
// the backdrop.
export default function DialogModal({
  open,
  onClose,
  title,
  children,
  footer,
}: DialogModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-[var(--surface-overlay)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "min(85vh, 720px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--separator)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center text-[var(--label-secondary)] active:scale-95 active:bg-[var(--fill-quaternary)] rounded-lg"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--label)]">{title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-[var(--separator)] px-3 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
