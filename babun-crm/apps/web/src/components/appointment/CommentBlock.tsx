"use client";

import { MessageSquare } from "@babun/shared/icons";

interface CommentBlockProps {
  value: string;
  readonly: boolean;
  onChange?: (next: string) => void;
}

// v707 — Common HVAC-dispatcher additions to the brigade note.
// Ordered by frequency of use; if the data shows a clear winner this
// can sharpen down to 3. Tapping a chip appends «, <chip>: » so the
// crew sees a structured note rather than four glued words.
const QUICK_CHIPS = [
  { label: "Домофон", insert: "домофон" },
  { label: "Этаж", insert: "этаж" },
  { label: "Собака", insert: "собака" },
  { label: "Звонок", insert: "звонок не работает" },
] as const;

function appendChip(current: string, snippet: string): string {
  const trimmed = current.trimEnd();
  if (!trimmed) return snippet + ": ";
  // Already ends with comma → just append the snippet without doubling
  // the punctuation. Otherwise comma-separate.
  const sep = /,\s*$/.test(current) ? " " : ", ";
  return trimmed + sep + snippet + ": ";
}

// Read-only: tinted chip if there's text, otherwise hidden.
// Edit: textarea always visible so the dispatcher can type without a tap.
export default function CommentBlock({ value, readonly, onChange }: CommentBlockProps) {
  if (readonly) {
    if (!value.trim()) return null;
    return (
      <div className="px-4 pt-2">
        <div className="px-3 py-2 rounded-[14px] bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.2)] text-[13px] text-[var(--label)] whitespace-pre-wrap flex items-start gap-2">
          <span className="flex-shrink-0 text-[var(--system-orange)] mt-0.5">
            <MessageSquare size={14} strokeWidth={2} />
          </span>
          <span>{value}</span>
        </div>
      </div>
    );
  }

  const handleChip = (snippet: string) => {
    if (!onChange) return;
    onChange(appendChip(value, snippet));
  };

  // Hide quick-chips once we're inside the last 50 chars — appending
  // would risk hitting the cap mid-snippet.
  const showChips = value.length < 450;

  return (
    <div className="px-4 pt-2">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        Заметка для бригады
      </div>
      {showChips && (
        <div
          className="flex gap-1.5 overflow-x-auto mb-1.5"
          style={{ scrollbarWidth: "none" }}
        >
          {QUICK_CHIPS.map((c) => (
            <button
              key={c.insert}
              type="button"
              onClick={() => handleChip(c.insert)}
              className="flex-shrink-0 inline-flex items-center h-8 px-3 rounded-full bg-[var(--fill-tertiary)] border border-[var(--separator)] text-[12px] font-semibold text-[var(--label)] active:scale-[0.97]"
              aria-label={`Вставить «${c.insert}»`}
            >
              + {c.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Зелёная дверь, домофон 25, собака во дворе, код подъезда…"
        rows={2}
        // v671 — 500 char cap. Calendar block + appointment list both
        // truncate to ~120 chars in display; a 50-char floor under
        // dispatcher's habits stays comfortable. Beyond 500 there's
        // no display path that would show it anyway and the JSON
        // payload starts bloating realtime echoes.
        maxLength={500}
        className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
      />
    </div>
  );
}
