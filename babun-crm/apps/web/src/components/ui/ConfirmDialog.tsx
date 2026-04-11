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

// Modal confirmation used for any destructive action — delete, cancel,
// clear, etc. Two buttons: a gray cancel and a red confirm. Tap on the
// backdrop closes the dialog without firing onConfirm.
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[16px] font-semibold text-gray-900 mb-1">
            {title}
          </h2>
          <p className="text-[13px] text-gray-600 leading-snug">{message}</p>
        </div>
        <div className="flex border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 text-[14px] font-medium text-gray-700 active:bg-gray-50 border-r border-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 h-12 text-[14px] font-semibold active:scale-[0.98] ${
              danger ? "text-red-600" : "text-indigo-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
