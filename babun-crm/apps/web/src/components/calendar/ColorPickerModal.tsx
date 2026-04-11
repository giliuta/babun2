"use client";

import DialogModal from "@/components/appointments/sheet/DialogModal";

interface ColorPickerModalProps {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (color: string | null) => void;
}

// Bumpix-style palette. Eight saturated swatches + a neutral gray that
// covers every usual appointment/event tint.
export const COLOR_PRESETS: string[] = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#84cc16", // lime
  "#6b7280", // slate
];

export default function ColorPickerModal({
  open,
  onClose,
  value,
  onPick,
}: ColorPickerModalProps) {
  const handleSelect = (color: string) => {
    onPick(color);
    onClose();
  };

  const handleReset = () => {
    onPick(null);
    onClose();
  };

  return (
    <DialogModal open={open} onClose={onClose} title="Выбрать цвет">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {COLOR_PRESETS.map((color) => {
            const selected = value === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => handleSelect(color)}
                aria-label={`Цвет ${color}`}
                className={`aspect-square rounded-full flex items-center justify-center active:scale-95 transition ${
                  selected
                    ? "ring-4 ring-offset-2 ring-gray-300"
                    : ""
                }`}
                style={{ backgroundColor: color }}
              >
                {selected && (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {value !== null && (
          <button
            type="button"
            onClick={handleReset}
            className="w-full h-11 text-[13px] font-medium text-gray-700 bg-gray-100 rounded-lg active:scale-[0.98]"
          >
            Сбросить цвет
          </button>
        )}
      </div>
    </DialogModal>
  );
}
