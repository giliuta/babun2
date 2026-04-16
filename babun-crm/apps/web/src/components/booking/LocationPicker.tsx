"use client";

import type { Location } from "@/lib/clients";

interface LocationPickerProps {
  locations: Location[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Горизонтальные чипы-объекты клиента. Активный — фиолетовая
// рамка. Под label мелким — количество блоков. Скрытый если
// location один (компоновщик не рендерит).
export default function LocationPicker({
  locations,
  selectedId,
  onSelect,
}: LocationPickerProps) {
  if (locations.length <= 1) return null;
  return (
    <div className="px-4 pt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        Объекты ({locations.length})
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {locations.map((loc) => {
          const active = loc.id === selectedId;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelect(loc.id)}
              className={`flex-shrink-0 min-w-[86px] px-3 py-2 rounded-xl border-2 text-left transition active:scale-[0.98] ${
                active
                  ? "border-violet-600 bg-violet-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`text-[13px] truncate ${
                  active ? "font-bold text-violet-700" : "font-semibold text-slate-800"
                }`}
              >
                {loc.label || "Без названия"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {loc.acUnits > 0 ? `${loc.acUnits} бл.` : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
