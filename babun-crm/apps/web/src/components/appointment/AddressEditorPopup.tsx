"use client";

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";
import { isLikelyUrl } from "@babun/shared/common/utils/map-links";

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

// Centered popup for adding/editing an object's address and crew note.
// Link-first: the address / map-link field is the prominent first input
// (paste a Google/Waze/Apple/Yandex link or type an address). The name
// is optional and secondary. Follows popup-design rule: fixed inset-0
// centered, rounded-[20px], no grabber pill.
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

  // Reset local state each time the popup opens so a stale draft from a
  // previous edit does not bleed through.
  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setCustomMode(initialCustom);
    setInput(initialInput);
    setNoteInput(initialNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // The object is its address/link; the name is optional.
  const canSave = Boolean(input.trim());
  const isLink = isLikelyUrl(input.trim());

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
                inputMode="text"
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

            {/* 2. Name — optional, secondary */}
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold text-[var(--label-secondary)]">
                Название · необязательно
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const active = !customMode && label === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setCustomMode(false);
                        setLabel(active ? "" : p);
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
              {customMode && (
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Своё название (Дом, Дача, Офис…)"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className={`${fieldCls} h-11 mt-2`}
                />
              )}
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
