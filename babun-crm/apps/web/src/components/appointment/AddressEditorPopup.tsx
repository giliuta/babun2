"use client";

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";

interface AddressEditorPopupProps {
  open: boolean;
  title: string;
  presets: string[];
  initialLabel: string;
  initialCustom: boolean;
  initialInput: string;
  initialNote: string;
  addrPlaceholder: string;
  onSave: (data: { label: string; input: string; note: string }) => void;
  onClose: () => void;
}

// Note max length — matches Location.note constraint (140 chars).
const NOTE_MAX = 140;

// Centered popup for adding/editing a location address and its note.
// Follows popup-design rule: fixed inset-0 flex items-center justify-center,
// rounded-[20px], no grabber pill. Keyboard opens beneath the popup —
// the underlying appointment sheet does not scroll.
export default function AddressEditorPopup({
  open,
  title,
  presets,
  initialLabel,
  initialCustom,
  initialInput,
  initialNote,
  addrPlaceholder,
  onSave,
  onClose,
}: AddressEditorPopupProps) {
  const [label, setLabel] = useState(initialLabel);
  const [customMode, setCustomMode] = useState(initialCustom);
  const [input, setInput] = useState(initialInput);
  const [noteInput, setNoteInput] = useState(initialNote);

  // Reset local state each time the popup opens (keyed on `open` flipping
  // to true) so stale draft from a previous edit does not bleed through.
  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setCustomMode(initialCustom);
    setInput(initialInput);
    setNoteInput(initialNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canSave = Boolean(label.trim() || input.trim());

  const handleSave = () => {
    if (!canSave) return;
    onSave({ label, input, note: noteInput });
  };

  const handleBackdrop = () => {
    // Tapping outside the card dismisses without saving.
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={handleBackdrop}
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
          <div className="p-3 space-y-2">
            {/* Label preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = !customMode && label === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setLabel(p);
                    }}
                    className={`h-8 px-3 rounded-full text-[12px] font-semibold transition ${
                      active
                        ? "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]"
                        : "bg-[var(--surface-card)] text-[var(--label-secondary)] border border-[var(--separator)]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  if (customMode) {
                    setCustomMode(false);
                    if (!presets.includes(label)) setLabel("");
                  } else {
                    setCustomMode(true);
                    if (presets.includes(label)) setLabel("");
                  }
                }}
                className={`h-8 px-3 rounded-full text-[12px] font-semibold transition ${
                  customMode
                    ? "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]"
                    : "bg-[var(--surface-card)] text-[var(--label-secondary)] border border-dashed border-[var(--separator)]"
                }`}
              >
                Другое…
              </button>
            </div>

            {/* Custom label input */}
            {customMode && (
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Своё название"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            )}

            {/* Address / Maps URL input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={addrPlaceholder}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={!customMode}
              className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />

            {/* Per-object note */}
            <textarea
              value={noteInput}
              onChange={(e) =>
                setNoteInput(e.target.value.slice(0, NOTE_MAX))
              }
              placeholder="зелёная дверь, домофон 25, что на объекте…"
              rows={2}
              maxLength={NOTE_MAX}
              className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
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
