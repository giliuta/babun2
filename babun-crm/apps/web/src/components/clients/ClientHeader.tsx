"use client";

// v813 — header for the unified client card (one page = create + view).
//
// Poster layout, inline-editable, NO avatar (removed; avatars live only
// on the chat page). Color budget: debt is RED, income is plain grey
// text (folded into the trust line), gold lives only on the ⭐VIP badge.
//
// VIEW mode  : NAME (title) + ⭐badges · PHONE (grey, editable) · DEBT
//              atom (red, only when долг>0) · one grey TRUST line
//              «{N} визитов · €{LTV} · был {дата}».
// CREATE mode: PHONE is the big title (autofocus), NAME the small line
//              below; nav shows «Готово» instead of «⋯». Derived lines
//              (debt/trust/badges) are hidden until the client exists.
//
// Name/phone are real inputs that persist via onPatch (immediate in
// view; into the draft in create).

import { useEffect, useRef } from "react";
import { ChevronLeft, MoreHorizontal, Check } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import ClientStatusBadges from "./ClientStatusBadges";
import { haptic } from "@/lib/haptics";

interface ClientHeaderProps {
  client: Client;
  stats: ClientStats | undefined;
  /** "view" = existing client; "create" = new empty card. */
  mode?: "view" | "create";
  onBack: () => void;
  /** view only */
  onOpenMenu?: () => void;
  /** create only */
  onDone?: () => void;
  doneEnabled?: boolean;
  /** Persist a name/phone edit (immediate in view, into draft in create). */
  onPatch: (patch: Partial<Client>) => void;
}

const MONTHS_RU_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** "2024-05-10" → "10 мая"; "" → "". */
function formatShortDateRu(key: string): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS_RU_SHORT[m - 1] ?? ""}`.trim();
}

function visitsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "визит";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "визита";
  return "визитов";
}

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString("ru-RU")}`;
}

export default function ClientHeader({
  client,
  stats,
  mode = "view",
  onBack,
  onOpenMenu,
  onDone,
  doneEnabled,
  onPatch,
}: ClientHeaderProps) {
  const isCreate = mode === "create";

  // Create mode: phone is THE primary field — autofocus it on mount so a
  // dispatcher can start typing the number straight away (the key for
  // dedup / звонок / запись). View mode never steals focus.
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isCreate) phoneRef.current?.focus();
    // Mount-only; mode never flips on a live instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debt = stats && stats.debt > 0 ? `Долг ${euro(stats.debt)}` : null;
  const trustSegments =
    !isCreate && stats
      ? ([
          stats.visits > 0 ? `${stats.visits} ${visitsWord(stats.visits)}` : null,
          stats.totalSpent > 0 ? euro(stats.totalSpent) : null,
          stats.lastVisitDate ? `был ${formatShortDateRu(stats.lastVisitDate)}` : null,
        ].filter(Boolean) as string[])
      : [];

  // Field sizes swap by mode: create → phone is the big title.
  const nameCls = isCreate
    ? "text-[15px] font-normal text-[var(--label-secondary)]"
    : "text-[20px] font-bold text-[var(--label)]";
  const phoneCls = isCreate
    ? "text-[22px] font-bold text-[var(--label)] tabular-nums"
    : "text-[15px] font-normal text-[var(--label-secondary)] tabular-nums";

  return (
    <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)]">
      {/* Nav row */}
      <div className="flex items-center gap-2 px-3 h-12">
        <button
          type="button"
          onClick={() => { haptic("light"); onBack(); }}
          aria-label="Назад"
          className="flex items-center gap-0.5 -ml-1 pr-2 h-9 text-[var(--accent)] active:opacity-60"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
          <span className="text-[15px]">Клиенты</span>
        </button>
        <div className="flex-1" />
        {isCreate ? (
          <button
            type="button"
            onClick={() => { if (doneEnabled) { haptic("light"); onDone?.(); } }}
            disabled={!doneEnabled}
            className={`px-2 h-9 text-[15px] font-semibold ${
              doneEnabled ? "text-[var(--accent)] active:opacity-60" : "text-[var(--label-tertiary)]"
            }`}
          >
            Готово
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { haptic("light"); onOpenMenu?.(); }}
            aria-label="Меню"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
          >
            <MoreHorizontal size={22} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Identity (poster, no avatar) */}
      <div className="px-4 pt-1 pb-3">
        <div className={`flex flex-col ${isCreate ? "" : ""}`}>
          {/* In create, phone is rendered first via order; use DOM order
              view=name→phone, create=phone→name through flex order. */}
          <div className={`flex items-center gap-1.5 min-w-0 ${isCreate ? "order-2" : "order-1"}`}>
            <input
              value={client.full_name}
              onChange={(e) => onPatch({ full_name: e.target.value })}
              placeholder={isCreate ? "Имя (можно позже)" : "Имя"}
              className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-[var(--label-tertiary)] ${nameCls}`}
            />
            {!isCreate && <ClientStatusBadges client={client} stats={stats} budget={3} />}
          </div>
          <div className={`flex items-center gap-2 ${isCreate ? "order-1" : "order-2 mt-0.5"}`}>
            <input
              ref={phoneRef}
              value={client.phone}
              onChange={(e) => onPatch({ phone: e.target.value })}
              placeholder="Телефон"
              inputMode="tel"
              autoComplete="tel"
              className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-[var(--label-tertiary)] ${phoneCls}`}
            />
            {isCreate && client.phone.replace(/\D/g, "").length >= 5 && (
              <Check size={18} strokeWidth={2.5} className="text-[var(--accent)] shrink-0" />
            )}
          </div>
        </div>

        {/* Derived lines (view only) */}
        {!isCreate && debt && (
          <div className="mt-1.5 text-[15px] font-semibold text-[var(--system-red)] tabular-nums">
            {debt}
          </div>
        )}
        {!isCreate && trustSegments.length > 0 && (
          <div className="mt-1 text-[13px] text-[var(--label-secondary)] tabular-nums">
            {trustSegments.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
