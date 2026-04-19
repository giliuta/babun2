"use client";

interface CommentBlockProps {
  value: string;
  readonly: boolean;
  onChange?: (next: string) => void;
}

// Read-only: amber chip if there's text, otherwise hidden.
// Edit: textarea always visible so the dispatcher can type without a tap.
export default function CommentBlock({ value, readonly, onChange }: CommentBlockProps) {
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

  return (
    <div className="px-4 pt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        Комментарий
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Код домофона, особенности…"
        rows={2}
        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
