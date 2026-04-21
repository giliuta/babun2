"use client";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}

// iOS system alert — 270 px narrow card, centered 17-px title,
// 13-px message, two buttons split by a vertical hairline. Apple's
// UIAlertController uses this exact proportion for destructive
// actions. Backdrop tap cancels.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  onClose,
  danger = true,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[280px] bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center">
          <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
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
