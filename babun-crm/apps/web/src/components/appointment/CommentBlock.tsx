"use client";

import { MessageSquare } from "@babun/shared/icons";

interface CommentBlockProps {
  value: string;
  readonly: boolean;
  onChange?: (next: string) => void;
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

  return (
    <div className="px-4 pt-2">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        Комментарий
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Код домофона, особенности…"
        rows={2}
        className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
      />
    </div>
  );
}
