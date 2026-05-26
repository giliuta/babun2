"use client";

import { useMemo } from "react";
import type { Client, ClientTag } from "@babun/shared/local/clients";
import { formatEUR } from "@babun/shared/common/utils/money";
import { formatShortDate } from "./ClientHistoryStrip";

interface ClientStats {
  visits: number;
  earned: number;
  lastVisitDate: string | null;
}

interface ClientBlockProps {
  client: Client | null;
  readonly: boolean;
  onPick?: () => void;
  /** @deprecated — kept so external callers still compile; no longer rendered.
   *  The empty state now uses a single "Выбрать клиента" button that opens
   *  ClientPickerSheet, which already hosts the inline "+ Новый клиент" form. */
  onCreate?: () => void;
  onChange?: () => void;
  onEdit?: () => void;
  /** If provided, shows a small menu button (⋯) next to the phone icon. */
  onMenu?: () => void;
  /** v611 P1 §13 — top-5 most-recently-used clients for the current
   *  master. Rendered as a horizontal chip strip above the picker
   *  button in the empty state; tap picks the client instantly and
   *  bypasses the full picker sheet. Empty array hides the strip. */
  recentClients?: Client[];
  onPickRecent?: (client: Client) => void;
  /** v699 — full tag catalog so we can paint a 4 × 4 px color dot on
   *  recent chips and on the filled card for clients carrying at
   *  least one tag. We just use the first tag in client.tag_ids —
   *  one dot is enough signal; the full list lives in the profile. */
  tags?: ClientTag[];
  /** One-line visit stats shown under the client name in the filled card.
   *  If undefined or visits === 0, shows "ещё не обслуживался". */
  stats?: ClientStats;
}

function firstTagColor(
  tagIds: string[] | undefined,
  tagsById: Map<string, ClientTag>,
): string | null {
  if (!tagIds || tagIds.length === 0) return null;
  for (const id of tagIds) {
    const tag = tagsById.get(id);
    if (tag) return tag.color;
  }
  return null;
}

// Блок 2: карточка клиента. Три состояния:
// — пусто + readonly=false → кнопка выбрать (picker уже содержит «+ Новый»)
// — заполнен + readonly=false → имя/телефон + статистика + ✕/меню
// — заполнен + readonly=true → имя/телефон (tel-link)
export default function ClientBlock({
  client,
  readonly,
  onPick,
  onChange,
  onEdit,
  onMenu,
  recentClients = [],
  onPickRecent,
  tags = [],
  stats,
}: ClientBlockProps) {
  void onEdit;
  const tagsById = useMemo(() => {
    const m = new Map<string, ClientTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  if (!client) {
    if (readonly) return null;
    return (
      <div className="px-4 pt-2 space-y-2">
        {recentClients.length > 0 && (
          <div
            className="flex gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {recentClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPickRecent?.(c)}
                // STORY audit: recent-client chips are the single-tap
                // shortcut for repeat customers — the most common case in
                // HVAC service. h-10 keeps ≥44 pt of real tap zone.
                className="flex-shrink-0 inline-flex items-center px-3.5 h-10 rounded-full bg-[var(--surface-card)] border border-[var(--separator)] text-[13px] font-semibold text-[var(--label)] active:scale-[0.97]"
              >
                <span className="truncate max-w-[140px]">{c.full_name}</span>
              </button>
            ))}
          </div>
        )}
        {/* Single entry point: picker sheet already contains "+ Новый клиент"
            so no separate "Новый" button is needed. */}
        <button
          type="button"
          onClick={onPick}
          className="w-full h-14 flex items-center gap-3 px-3 rounded-[14px] bg-[var(--surface-card)] border border-dashed border-[var(--separator)] active:scale-[0.99]"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center flex-shrink-0 text-[16px] font-bold">
            +
          </div>
          <span className="text-[15px] font-semibold text-[var(--label-secondary)]">
            Выбрать клиента
          </span>
        </button>
      </div>
    );
  }

  const phone = client.phone;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  const filledDot = firstTagColor(client.tag_ids, tagsById);

  // Build the stats line text.
  const statsLine = (() => {
    if (!stats || stats.visits === 0) return "ещё не обслуживался";
    const visitWord = (() => {
      const n = stats.visits % 100;
      const n1 = stats.visits % 10;
      if (n >= 11 && n <= 19) return "визитов";
      if (n1 === 1) return "визит";
      if (n1 >= 2 && n1 <= 4) return "визита";
      return "визитов";
    })();
    const datePart = stats.lastVisitDate
      ? ` · был ${formatShortDate(stats.lastVisitDate)}`
      : "";
    return `${stats.visits} ${visitWord} · ${formatEUR(stats.earned)}${datePart}`;
  })();

  return (
    <div className="px-4 pt-2">
      <div className="min-h-14 flex items-center gap-3 px-3 py-2 rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)]">
        <button
          type="button"
          onClick={readonly ? undefined : onPick}
          disabled={readonly}
          className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-70"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold text-[var(--label)] truncate flex items-center gap-1.5">
              {filledDot && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: filledDot }}
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{client.full_name}</span>
              {client.discount > 0 && (
                // v703 — personal client.discount pill.
                <span
                  className="flex-shrink-0 inline-flex items-center h-5 px-1.5 rounded-[6px] bg-[var(--fill-tertiary)] text-[var(--label-secondary)] text-[11px] font-semibold tabular-nums"
                  aria-label={`Персональная скидка ${client.discount} процентов`}
                >
                  −{client.discount}%
                </span>
              )}
            </div>
            {phone && (
              <div className="text-[13px] font-medium text-[var(--label-secondary)] tabular-nums truncate">
                {phone}
              </div>
            )}
            {client.comment && client.comment.trim() && (
              <div className="text-[12px] text-[var(--label-tertiary)] truncate mt-0.5">
                {client.comment.trim()}
              </div>
            )}
            {/* v697 — Balance row. Hidden at zero. */}
            {client.balance !== 0 && (
              <div
                className={`text-[12px] tabular-nums truncate mt-0.5 ${
                  client.balance > 0
                    ? "text-[var(--system-green)]"
                    : "text-[var(--system-red)]"
                }`}
              >
                {client.balance > 0
                  ? `+${formatEUR(client.balance)} предоплата`
                  : `${formatEUR(client.balance)} долг`}
              </div>
            )}
            {/* Stats line: visit count · LTV · last visit date. */}
            <div className="text-[12px] text-[var(--label-secondary)] tabular-nums truncate mt-0.5">
              {statsLine}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {phone && phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              aria-label="Позвонить"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </a>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label="Меню"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          )}
          {!readonly && !onMenu && onChange && (
            <button
              type="button"
              onClick={onChange}
              aria-label="Сменить"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
