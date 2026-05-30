"use client";

import { X } from "@babun/shared/icons";
import type { Location } from "@babun/shared/local/clients";

interface ObjectPickerPopupProps {
  open: boolean;
  locations: Location[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onEdit: (loc: Location) => void;
  onClose: () => void;
}

// Centered picker for choosing which of the client's saved objects this
// appointment is at — or adding a new one. Tap a row to select; the
// pencil edits that object; "＋ Новый объект" opens the add form.
// Follows the popup-design rule (fixed inset-0 centered, rounded-[20px]).
export default function ObjectPickerPopup({
  open,
  locations,
  selectedId,
  onSelect,
  onAddNew,
  onEdit,
  onClose,
}: ObjectPickerPopupProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
            Объект клиента
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {locations.map((loc) => {
            const isSel = loc.id === selectedId;
            const sub =
              loc.address?.trim() ||
              (loc.mapUrl ? "🔗 ссылка на карту" : "—");
            return (
              <div
                key={loc.id}
                className={`flex items-center gap-2 rounded-[12px] border px-2.5 py-2 ${
                  isSel
                    ? "border-[var(--accent)] bg-[var(--accent-tint)]"
                    : "border-[var(--separator)] bg-[var(--surface-card)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(loc.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0 active:opacity-80"
                >
                  <span className="w-[30px] h-[30px] rounded-[7px] bg-[var(--tile-indigo)] text-white flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l9-7 9 7" />
                      <path d="M5 10v10h14V10" />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-[var(--label)] truncate">
                      {loc.label || "Объект"}
                    </span>
                    <span className="block text-[13px] text-[var(--label-secondary)] truncate">
                      {sub}
                    </span>
                  </span>
                  {isSel && (
                    <span className="text-[var(--accent)] font-bold text-[17px] flex-shrink-0 pr-1">
                      ✓
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(loc)}
                  aria-label="Изменить объект"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] flex-shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddNew}
            className="w-full rounded-[12px] border border-dashed border-[var(--separator)] px-3 py-3 text-[15px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
          >
            ＋ Новый объект
          </button>
        </div>
      </div>
    </div>
  );
}
