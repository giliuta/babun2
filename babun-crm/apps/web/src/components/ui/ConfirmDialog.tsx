"use client";

import { useEffect } from "react";
import { registerModalBack } from "@/lib/history-stack";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}

// Telegram system alert — 280 px narrow card, centered 17-px bold
// title, 13-px body, two full-width buttons split by a hairline. The
// confirm button is accent-blue for benign actions, red for
// destructive. Backdrop tap cancels.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  onClose,
  danger = true,
}: ConfirmDialogProps) {
  // STORY-053b — hardware Back / iOS edge-swipe should cancel the
  // confirm dialog (treat as decline), not navigate away.
  useEffect(() => {
    const popClose = registerModalBack("confirm-dialog", onClose);
    return popClose;
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[280px] bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center">
          <h2 className="text-[17px] font-semibold text-[var(--label)]">
            {title}
          </h2>
          {message && (
            <p className="text-[13px] text-[var(--label-secondary)] leading-snug mt-1.5">
              {message}
            </p>
          )}
        </div>
        <div className="flex border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 text-[17px] font-normal text-[var(--accent)] active:bg-[var(--fill-quaternary)] border-r border-[var(--separator)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 h-11 text-[17px] font-semibold active:bg-[var(--fill-quaternary)] ${
              danger ? "text-[var(--system-red)]" : "text-[var(--accent)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
