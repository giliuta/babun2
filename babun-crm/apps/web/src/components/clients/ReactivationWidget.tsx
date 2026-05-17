// Reactivation widget — Sprint clients-99 (F3.3).
//
// Surfaces when ≥1 clients haven't booked in 90+ days. Gives the
// dispatcher a single tap to either filter the list down or fire a
// bulk SMS blast at the silent cohort. Sits above the search row so
// it doesn't disappear under the fold.

"use client";

import { Bell, Send } from "@babun/shared/icons";
import { countWordRu } from "@babun/shared/common/utils/pluralize";

interface Props {
  count: number;
  onFilter: () => void;
  /** Optional — only show "Отправить SMS" CTA if the parent can handle it. */
  onSmsBlast?: () => void;
}

export function ReactivationWidget({ count, onFilter, onSmsBlast }: Props) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--separator)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(255,149,0,0.12)] text-[var(--system-orange)]">
        <Bell size={18} strokeWidth={2.2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[var(--label)]">
          {count}{" "}
          {countWordRu(count, "клиент", "клиента", "клиентов")}{" "}
          не были 90+ дней
        </div>
        <div className="text-[12px] text-[var(--label-secondary)]">
          Самое время напомнить о себе.
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onFilter}
          className="h-9 rounded-full border border-[var(--separator)] px-3 text-[13px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          Показать
        </button>
        {onSmsBlast && (
          <button
            type="button"
            onClick={onSmsBlast}
            className="flex h-9 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--label-on-accent)] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
          >
            <Send size={14} strokeWidth={2.2} aria-hidden />
            SMS
          </button>
        )}
      </div>
    </div>
  );
}
