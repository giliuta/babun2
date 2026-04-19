"use client";

import { useState } from "react";

interface CommentBlockProps {
  value: string;
  readonly: boolean;
  onChange?: (next: string) => void;
}

// Compact comment block.
// - read-only: amber chip only when there is text, otherwise hidden
// - edit empty: one-line "+ Комментарий" button
// - edit with text or after user tap: textarea (rows=2)
export default function CommentBlock({ value, readonly, onChange }: CommentBlockProps) {
  const [open, setOpen] = useState(Boolean(value.trim()));

  if (readonly) {
    if (!value.trim()) return null;
    return (
      <div className="px-4 pt-2">
        <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900 whitespace-pre-wrap">
          <span className="mr-1">💬</span>
          {value}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-9 rounded-lg bg-white border border-dashed border-slate-300 text-[12px] font-medium text-slate-500 active:bg-slate-50"
        >
          + Комментарий
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-2">
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Код домофона, особенности…"
        rows={2}
        autoFocus
        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
      />
    </div>
  );
}
