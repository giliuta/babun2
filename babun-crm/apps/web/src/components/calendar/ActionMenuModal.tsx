"use client";

import { useEffect, useRef, useState } from "react";

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

// iOS UIAlertController.ActionSheet style — grouped-list of actions
// with a separate "Отмена" pill below. Each option is a 44-pt row;
// destructive actions render in system-red; the cancel sheet below
// is visually detached with a 8-pt gap. Backdrop becomes armed
// 300 ms after open so the long-press release doesn't instantly
// dismiss the menu.
export default function ActionMenuModal({
  open,
  onClose,
  title,
  options,
}: ActionMenuModalProps) {
  const [armed, setArmed] = useState(false);
  const openedAt = useRef(0);

  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    openedAt.current = Date.now();
    const armTimer = window.setTimeout(() => setArmed(true), 300);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    if (!armed) return;
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[var(--surface-overlay)]"
      onPointerDown={handleBackdropPointerDown}
      data-testid="action-menu"
    >
      <div
        className="w-full max-w-md flex flex-col gap-2 select-none"
        style={{
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden flex flex-col shadow-[var(--shadow-sheet)]"
          style={{ maxHeight: "min(75vh, 640px)" }}
        >
          <div className="px-4 py-3 text-center border-b border-[var(--separator)] flex-shrink-0">
            <h2 className="text-[13px] font-semibold text-[var(--label-secondary)] tracking-tight">
              {title}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--separator)]">
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
                  data-testid={`action-menu-option-${i}`}
                  data-action-label={opt.label}
                  className={`w-full text-center px-4 py-3 min-h-[48px] select-none transition ${
                    opt.disabled
                      ? "cursor-not-allowed"
                      : "active:bg-[var(--fill-quaternary)]"
                  }`}
                >
                  <div
                    className={`text-[16px] ${
                      opt.disabled
                        ? "text-[var(--label-tertiary)]"
                        : opt.danger
                          ? "text-[var(--system-red)] font-normal"
                          : "text-[var(--accent)] font-normal"
                    }`}
                  >
                    {opt.label}
                  </div>
                  {opt.subtitle && (
                    <div className="text-[12px] mt-0.5 text-[var(--label-tertiary)]">
                      {opt.subtitle}
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-testid="action-menu-cancel"
          className="w-full h-[52px] bg-[var(--surface-card)] rounded-[14px] text-[17px] font-semibold text-[var(--accent)] shadow-[var(--shadow-sheet)] active:bg-[var(--fill-quaternary)] transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
