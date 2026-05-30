"use client";

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";
import { isLikelyUrl } from "@babun/shared/common/utils/map-links";
import type { LocationLabel } from "@babun/shared/local/location-labels";

interface AddressEditorPopupProps {
  open: boolean;
  title: string;
  /** Editable reusable name chips (managed right here in the form). */
  labels: LocationLabel[];
  onAddLabel: (name: string) => void;
  onRemoveLabel: (id: string) => void;
  initialLabel: string;
  initialInput: string;
  initialNote: string;
  addrPlaceholder: string;
  onSave: (data: { label: string; input: string; note: string }) => void;
  onClose: () => void;
}

// Note max length — matches Location.note constraint (140 chars).
const NOTE_MAX = 140;

// Centered popup for adding/editing an object's address and crew note.
// Link-first (address / map link is the prominent first field). The
// optional name has EDITABLE chips: tap a chip to fill the name, ✕ to
// remove it, and "＋ сохранить «…»" to save the typed name as a new
// reusable chip. Chip management lives only here in the booking form.
export default function AddressEditorPopup({
  open,
  title,
  labels,
  onAddLabel,
  onRemoveLabel,
  initialLabel,
  initialInput,
  initialNote,
  addrPlaceholder,
  onSave,
  onClose,
}: AddressEditorPopupProps) {
  const [label, setLabel] = useState(initialLabel);
  const [input, setInput] = useState(initialInput);
  const [noteInput, setNoteInput] = useState(initialNote);

  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setInput(initialInput);
    setNoteInput(initialNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // The object is its address/link; the name is optional.
  const canSave = Boolean(input.trim());
  const isLink = isLikelyUrl(input.trim());
  const trimmedLabel = label.trim();
  const canAddChip =
    Boolean(trimmedLabel) && !labels.some((l) => l.name === trimmedLabel);

  const handleSave = () => {
    if (!canSave) return;
    onSave({ label, input, note: noteInput });
  };

  const fieldCls =
    "w-full px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]";

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
            {title}
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

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3.5 space-y-4">
            {/* 1. Address / map-link — the primary field */}
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold text-[var(--label-secondary)]">
                Адрес или ссылка на карту
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={addrPlaceholder}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className={`${fieldCls} h-12`}
              />
              <div className="px-1 pt-1.5 text-[12px] text-[var(--label-secondary)] leading-snug">
                {isLink ? (
                  <span className="text-[var(--system-green)] font-medium">
                    🔗 Ссылка распознана — откроется в навигаторе
                  </span>
                ) : (
                  "Можно вставить ссылку Google / Waze / Apple / Яндекс или ввести адрес"
                )}
              </div>
            </div>

            {/* 2. Name — optional, with editable chips */}
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold text-[var(--label-secondary)]">
                Название · необязательно
              </div>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Дом, Квартира, Офис…"
                className={`${fieldCls} h-11`}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {labels.map((l) => {
                  const active = trimmedLabel === l.name;
                  return (
                    <span
                      key={l.id}
                      className={`h-9 pl-3.5 pr-1 rounded-full text-[13px] font-semibold inline-flex items-center gap-0.5 border ${
                        active
                          ? "bg-[var(--accent-tint)] text-[var(--accent)] border-[var(--accent)]"
                          : "bg-[var(--surface-card)] text-[var(--label-secondary)] border-[var(--separator)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setLabel(active ? "" : l.name)}
                        className="h-full pr-0.5 flex items-center active:opacity-70"
                      >
                        {l.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveLabel(l.id)}
                        aria-label={`Удалить ${l.name}`}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
                {canAddChip && (
                  <button
                    type="button"
                    onClick={() => onAddLabel(trimmedLabel)}
                    className="h-9 px-3.5 rounded-full text-[13px] font-semibold bg-[var(--accent-tint)] text-[var(--accent)] border border-dashed border-[var(--accent)]"
                  >
                    ＋ сохранить «{trimmedLabel}»
                  </button>
                )}
              </div>
            </div>

            {/* 3. Crew note */}
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold text-[var(--label-secondary)]">
                Заметка для бригады
              </div>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value.slice(0, NOTE_MAX))}
                placeholder="код домофона, этаж, зелёная дверь…"
                rows={2}
                maxLength={NOTE_MAX}
                className={`${fieldCls} py-2 text-[14px] resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div
          className="flex-shrink-0 flex gap-2 px-3 pt-2 border-t border-[var(--separator)]"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] text-[var(--accent)] font-medium text-[15px]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
