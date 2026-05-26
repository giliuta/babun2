"use client";

import { Check } from "@babun/shared/icons";
import { TEAM_COLORS } from "@babun/shared/local/masters";

interface TeamColorPopupProps {
  open: boolean;
  current: string;
  onPick: (color: string) => void;
  onClose: () => void;
}

// Small centered popup with the unified team-colour swatches. Opened from
// the palette icon next to the calendar name field.
export default function TeamColorPopup({
  open,
  current,
  onPick,
  onClose,
}: TeamColorPopupProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight mb-4">
          Цвет
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {TEAM_COLORS.map((c) => {
            const picked = c.value === current;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onPick(c.value);
                  onClose();
                }}
                aria-label={c.name}
                className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                style={{ backgroundColor: c.value }}
              >
                {picked && (
                  <Check
                    size={16}
                    strokeWidth={3}
                    className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
