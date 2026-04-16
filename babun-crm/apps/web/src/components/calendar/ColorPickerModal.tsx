"use client";

import DialogModal from "@/components/appointments/sheet/DialogModal";

interface ColorPickerModalProps {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (color: string | null) => void;
}

// Десятицветная палитра — специально короткая: автоматика уже
// раскрашивает статус/адрес/время, а эта палитра для «личной» метки
// (VIP, срочный, повторный выезд). 6-колоночная сетка,
// свотчи крупные — палец попадает сразу.
export const COLOR_PRESETS: string[] = [
  "#ef4444", // красный — срочно / проблемный
  "#f97316", // оранжевый — коммерция
  "#f59e0b", // янтарь — требует внимания
  "#eab308", // жёлтый
  "#22c55e", // зелёный — готово / ок
  "#06b6d4", // бирюзовый
  "#3b82f6", // синий
  "#6366f1", // индиго
  "#a855f7", // фиолетовый — VIP
  "#ec4899", // розовый
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
    <DialogModal open={open} onClose={onClose} title="Свой цвет">
      <div className="p-4 space-y-4">
        <p className="text-[12px] text-gray-500">
          Статус, адрес и время уже раскрашиваются автоматически. Эта палитра
          — личная метка для «своих» целей (VIP, срочно, проблемный).
        </p>
        <div className="grid grid-cols-5 gap-3">
          {COLOR_PRESETS.map((color) => {
            const selected = value === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => handleSelect(color)}
                aria-label={`Цвет ${color}`}
                className={`aspect-square rounded-full flex items-center justify-center active:scale-95 transition ${
                  selected ? "ring-2 ring-offset-2 ring-gray-800" : ""
                }`}
                style={{ backgroundColor: color }}
              >
                {selected && (
                  <svg
                    width="20"
                    height="20"
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
            Сбросить цвет — вернуть автоматику
          </button>
        )}
      </div>
    </DialogModal>
  );
}
