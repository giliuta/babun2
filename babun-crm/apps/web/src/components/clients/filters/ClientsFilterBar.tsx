"use client";

// v809 — summary filter bar. Idle: funnel + «Фильтры» + «Всего N
// клиентов» + chevron. Active: accent funnel + count badge + a wrap of
// removable colour-dotted value tokens, then a thin «Найдено: N» /
// «Сбросить» line. Tapping the bar (except a token ✕) opens the panel.

import { Filter, ChevronDown, X } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { countWordRu } from "@babun/shared/common/utils/pluralize";
import type { ActiveToken } from "./types";

interface ClientsFilterBarProps {
  /** Total client count (whole tenant) — shown when idle. */
  totalCount: number;
  /** Count after filters — shown on the «Найдено» line when active. */
  foundCount: number;
  /** Number of active filter values (drives the badge). */
  activeCount: number;
  /** Removable value tokens (teams / cities / tags / period). */
  tokens: ActiveToken[];
  /** Open the centered panel. */
  onOpen: () => void;
  /** Remove a single token's value (live). */
  onRemoveToken: (token: ActiveToken) => void;
  /** Clear ALL filters (not sort). */
  onReset: () => void;
}

export function ClientsFilterBar({
  totalCount,
  foundCount,
  activeCount,
  tokens,
  onOpen,
  onRemoveToken,
  onReset,
}: ClientsFilterBarProps) {
  const active = activeCount > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Main bar — tapping anywhere (except a token ✕) opens the panel */}
      <button
        type="button"
        onClick={() => {
          haptic("tap");
          onOpen();
        }}
        className={`w-full flex items-center gap-2 min-h-[40px] px-3 py-1.5 rounded-[12px] border transition text-left press-scale ${
          active
            ? "bg-[var(--accent-tint)] border-transparent"
            : "bg-[var(--surface-card)] border-[var(--separator)] shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)]"
        }`}
      >
        <span
          className={`shrink-0 flex items-center ${
            active ? "text-[var(--accent)]" : "text-[var(--label-secondary)]"
          }`}
        >
          <Filter size={16} strokeWidth={2.2} />
        </span>

        {active ? (
          <>
            <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[11px] font-bold tabular-nums">
              {activeCount}
            </span>
            <span className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
              {tokens.map((t) => (
                <span
                  key={`${t.key}:${t.val}`}
                  className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-full bg-[var(--surface-card)] text-[var(--label)] text-[12px] font-semibold border border-[var(--separator)]"
                >
                  {t.color && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  <span className="truncate max-w-[120px]">{t.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Убрать ${t.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic("tap");
                      onRemoveToken(t);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveToken(t);
                      }
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] cursor-pointer"
                  >
                    <X size={12} strokeWidth={2.6} />
                  </span>
                </span>
              ))}
            </span>
          </>
        ) : (
          <>
            <span className="text-[14px] font-semibold text-[var(--label)]">
              Фильтры
            </span>
            <span className="flex-1" />
            <span className="text-[13px] text-[var(--label-secondary)] tabular-nums shrink-0">
              Всего {totalCount}{" "}
              {countWordRu(totalCount, "клиент", "клиента", "клиентов")}
            </span>
            <ChevronDown
              size={16}
              strokeWidth={2.2}
              className="text-[var(--label-tertiary)] shrink-0"
            />
          </>
        )}
      </button>

      {/* «Найдено: N» + «Сбросить» — only when filters are active */}
      {active && (
        <div className="flex items-center justify-between px-1 text-[12px]">
          <span className="text-[var(--label-secondary)] tabular-nums">
            Найдено: <span className="font-semibold text-[var(--label)]">{foundCount}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              onReset();
            }}
            className="text-[var(--accent)] font-semibold active:opacity-60 transition"
          >
            Сбросить
          </button>
        </div>
      )}
    </div>
  );
}
