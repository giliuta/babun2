"use client";

import { useEffect } from "react";

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

// Bumpix-style action menu: purple header bar, vertical list of options
// with optional subtitles, and a right-aligned "ОТМЕНА" button in the
// footer. Used for the empty-slot tap menu and the appointment
// long-press menu.
export default function ActionMenuModal({
  open,
  onClose,
  title,
  options,
}: ActionMenuModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col select-none"
        style={{
          maxHeight: "min(85vh, 720px)",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Purple header — matches Bumpix */}
        <div className="bg-indigo-600 px-4 py-3 flex-shrink-0">
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        </div>

        {/* Options list — enabled items first, disabled ("Скоро") at the
            bottom so active actions are always on top */}
        <div
          className="flex-1 overflow-y-auto select-none"
          style={{
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          {[...options]
            .sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled))
            .map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  opt.onSelect();
                  onClose();
                }}
                className={`w-full text-left px-4 py-3 border-t border-gray-100 first:border-t-0 select-none ${
                  opt.disabled
                    ? "cursor-not-allowed"
                    : "active:bg-gray-50"
                }`}
                style={{
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                <div
                  className={`text-[14px] font-normal ${
                    opt.disabled
                      ? "text-gray-400"
                      : opt.danger
                        ? "text-red-600"
                        : "text-gray-900"
                  }`}
                >
                  {opt.label}
                </div>
                {opt.subtitle && (
                  <div
                    className={`text-[11px] mt-0.5 ${
                      opt.disabled ? "text-gray-300" : "text-gray-500"
                    }`}
                  >
                    {opt.subtitle}
                  </div>
                )}
              </button>
            ))}
        </div>

        {/* Footer with ОТМЕНА */}
        <div className="flex justify-end px-2 py-2 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-indigo-600 uppercase tracking-wide active:opacity-70"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
