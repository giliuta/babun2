"use client";

import type { Location } from "@/lib/clients";

interface LocationPickerProps {
  locations: Location[];
  selectedId: string | null;
  readonly: boolean;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
}

// Блок 3. Показывается только когда у клиента больше одного объекта.
// Горизонтальные чипы + «+ Объект» в конце (скрыт в readonly).
export default function LocationPicker({
  locations,
  selectedId,
  readonly,
  onSelect,
  onAdd,
}: LocationPickerProps) {
  if (locations.length <= 1) return null;
  return (
    <div className="px-4 pt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)] mb-1.5">
        Объекты ({locations.length})
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {locations.map((loc) => {
          const active = loc.id === selectedId;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={readonly ? undefined : () => onSelect?.(loc.id)}
              disabled={readonly}
              className={`flex-shrink-0 min-w-[86px] px-3 py-2 rounded-xl border-2 text-left transition ${
                active ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--separator)] bg-white"
              } ${readonly ? "" : "active:scale-[0.98]"}`}
            >
              <div
                className={`text-[13px] truncate ${
                  active ? "font-bold text-[var(--accent)]" : "font-semibold text-[var(--label)]"
                }`}
              >
                {loc.label || "Без названия"}
              </div>
            </button>
          );
        })}
        {!readonly && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex-shrink-0 min-w-[86px] px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
          >
            + Объект
          </button>
        )}
      </div>
    </div>
  );
}
