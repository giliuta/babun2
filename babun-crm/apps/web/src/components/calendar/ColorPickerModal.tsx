"use client";

import DialogModal from "@/components/appointments/sheet/DialogModal";

interface ColorPickerModalProps {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (color: string | null) => void;
}

// Full 48-swatch palette (Bumpix parity): 6 columns × 8 rows spanning
// the hue wheel with three brightness tiers so any appointment tint is
// reachable without a color wheel.
export const COLOR_PRESETS: string[] = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c",
  "#fca5a5", "#fdba74", "#fcd34d", "#fde047", "#bef264", "#86efac",
  "#6ee7b7", "#5eead4", "#67e8f9", "#7dd3fc", "#93c5fd", "#a5b4fc",
  "#c4b5fd", "#d8b4fe", "#f0abfc", "#f9a8d4", "#fda4af", "#a8a29e",
  "#b91c1c", "#c2410c", "#b45309", "#a16207", "#4d7c0f", "#15803d",
  "#047857", "#0f766e", "#0e7490", "#0369a1", "#1d4ed8", "#4338ca",
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
        <div className="grid grid-cols-6 gap-2">
          {COLOR_PRESETS.map((color) => {
            const selected = value === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => handleSelect(color)}
                aria-label={`Цвет ${color}`}
                className={`aspect-square rounded-full flex items-center justify-center active:scale-95 transition ${
                  selected ? "ring-2 ring-offset-1 ring-gray-400" : ""
                }`}
                style={{ backgroundColor: color }}
              >
                {selected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
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
