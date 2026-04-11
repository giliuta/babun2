"use client";

import DialogModal from "@/components/appointments/sheet/DialogModal";

export interface ActionMenuOption {
  label: string;
  subtitle?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ActionMenuModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: ActionMenuOption[];
}

// Generic vertical list menu used for the empty-slot tap action sheet
// and the appointment long-press action sheet. Matches Bumpix's style:
// plain white panel, titled rows, separator lines, last row may be red.
export default function ActionMenuModal({
  open,
  onClose,
  title,
  options,
}: ActionMenuModalProps) {
  return (
    <DialogModal open={open} onClose={onClose} title={title}>
      <div className="py-1">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={opt.disabled}
            onClick={() => {
              if (opt.disabled) return;
              opt.onSelect();
              onClose();
            }}
            className={`w-full text-left px-4 py-3 border-t border-gray-100 active:bg-gray-50 first:border-t-0 ${
              opt.disabled ? "opacity-40" : ""
            }`}
          >
            <div
              className={`text-[14px] font-medium ${
                opt.danger ? "text-red-600" : "text-gray-900"
              }`}
            >
              {opt.label}
            </div>
            {opt.subtitle && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                {opt.subtitle}
              </div>
            )}
          </button>
        ))}
      </div>
    </DialogModal>
  );
}
