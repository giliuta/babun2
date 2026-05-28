"use client";

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";

interface NotePopupProps {
  open: boolean;
  value: string;
  onSave: (next: string) => void;
  onClose: () => void;
}

// Centered popup for editing the per-appointment brigade note.
// Follows popup-design rule: fixed inset-0 flex items-center justify-center,
// rounded-[20px], no grabber pill. Reset local state on open.
export default function NotePopup({ open, value, onSave, onClose }: NotePopupProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    onSave(draft.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
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
            Заметка к записи
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Зелёная дверь, домофон 25, собака во дворе, код подъезда…"
            rows={6}
            maxLength={500}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full px-3.5 py-3 rounded-[14px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
          <div className="mt-1 text-right text-[11px] text-[var(--label-tertiary)] tabular-nums">
            {draft.length}/500
          </div>
        </div>

        {/* Footer */}
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
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
