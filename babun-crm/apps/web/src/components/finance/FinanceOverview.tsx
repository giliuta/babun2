"use client";

// Finances home overview (the approved mockup): single-team chips +
// period + «Счета» mini-card + Доход/Расход + Долги|Прибыль row.
// The whole block is sticky so it stays pinned while the operations feed
// scrolls underneath. Tapping a metric tells the parent which panel to
// show below and rings the active card (like «Долги»).

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Team } from "@babun/shared/local/masters";
import type { PeriodTotals } from "@/lib/finance/ledger-compute";
import PeriodPicker from "./PeriodPicker";
import type { PeriodKind, PeriodRange } from "@/lib/finance/period";

export type HomeView = "all" | "accounts" | "income" | "expense" | "debt" | "profit";

const PROFIT_COLOR = "#34AADC"; // locked: прибыль is always light-blue

interface FinanceOverviewProps {
  teams: Team[];
  scopeTeamId: string | null;
  onScopeChange: (id: string) => void;
  period: PeriodKind;
  onPeriodChange: (kind: PeriodKind) => void;
  range: PeriodRange;
  onCustomRange: (range: PeriodRange) => void;
  totals: PeriodTotals;
  acctTotal: number;
  view: HomeView;
  onTapAccounts: () => void;
  onTapIncome: () => void;
  onTapExpense: () => void;
  onTapDebt: () => void;
  onTapProfit: () => void;
}

export default function FinanceOverview({
  teams,
  scopeTeamId,
  onScopeChange,
  period,
  onPeriodChange,
  range,
  onCustomRange,
  totals,
  acctTotal,
  view,
  onTapAccounts,
  onTapIncome,
  onTapExpense,
  onTapDebt,
  onTapProfit,
}: FinanceOverviewProps) {
  return (
    // Whole overview pinned — only the feed below scrolls.
    <div className="sticky top-0 z-20 bg-[var(--surface-grouped)]">
      {/* Team chips + period */}
      <div className="bg-[var(--surface-card)] border-b border-[var(--separator)] px-3 pt-2 pb-2 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {teams.map((t) => {
            const active = scopeTeamId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onScopeChange(t.id)}
                aria-pressed={active}
                className="flex-shrink-0 h-9 px-4 rounded-full text-[15px] font-semibold border-[1.5px] inline-flex items-center gap-2 transition-colors"
                style={
                  active
                    ? { backgroundColor: t.color, borderColor: t.color, color: "#fff" }
                    : { backgroundColor: "var(--surface-card)", borderColor: t.color, color: t.color }
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>
        <PeriodPicker
          value={period}
          onChange={onPeriodChange}
          range={range}
          onCustomRange={onCustomRange}
        />
      </div>

      {/* Overview cards */}
      <div className="px-4 pt-3 pb-2.5 space-y-2">
        {/* Счета mini-card */}
        <button
          type="button"
          onClick={onTapAccounts}
          aria-pressed={view === "accounts"}
          className={`flex w-full items-center gap-2.5 bg-[var(--surface-card)] rounded-[12px] px-3.5 py-2.5 text-left active:scale-[0.99] transition ${
            view === "accounts" ? "shadow-[inset_0_0_0_1.5px_var(--accent)]" : "shadow-[var(--shadow-card)]"
          }`}
        >
          <WalletIcon />
          <span className="text-[14px] font-semibold text-[var(--label-secondary)]">
            Счета
          </span>
          <span className="ml-auto text-[15px] font-semibold tabular-nums">
            {formatEUR(acctTotal)}
          </span>
          <ChevronRight />
        </button>

        {/* Доход / Расход — separate ring cards (active outline like «Долги») */}
        <div className="flex gap-2">
          <MetricCard
            label="Доход"
            value={totals.income}
            color="var(--system-green)"
            active={view === "income"}
            onClick={onTapIncome}
          />
          <MetricCard
            label="Расход"
            value={totals.expense}
            color="var(--system-red)"
            active={view === "expense"}
            onClick={onTapExpense}
            negative
          />
        </div>

        {/* Долги | Прибыль */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTapDebt}
            aria-pressed={view === "debt"}
            className={`flex-1 flex items-center gap-2 bg-[var(--surface-card)] rounded-[12px] px-3.5 py-2.5 active:scale-[0.99] transition ${
              view === "debt" ? "shadow-[inset_0_0_0_1.5px_var(--system-orange)]" : "shadow-[var(--shadow-card)]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--system-orange)]" />
            <span className="text-[14px] font-semibold text-[var(--label-secondary)]">
              Долги
            </span>
            <span className="ml-auto text-[15px] font-bold tabular-nums text-[var(--system-orange)]">
              {formatEUR(totals.debt)}
            </span>
          </button>
          <button
            type="button"
            onClick={onTapProfit}
            aria-pressed={view === "profit"}
            aria-label="Разбор прибыли"
            className="flex-1 flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 active:scale-[0.99] transition"
            style={{
              backgroundColor:
                view === "profit" ? "rgba(52,170,220,0.16)" : "rgba(52,170,220,0.07)",
              boxShadow:
                view === "profit"
                  ? `inset 0 0 0 1.5px ${PROFIT_COLOR}`
                  : "inset 0 0 0 0.5px rgba(52,170,220,0.16)",
            }}
          >
            <span className="text-[14px] font-semibold" style={{ color: PROFIT_COLOR }}>
              Прибыль
            </span>
            <span className="ml-auto text-[15px] font-bold tabular-nums" style={{ color: PROFIT_COLOR }}>
              {totals.profit >= 0 ? "+" : "−"}
              {formatEUR(Math.abs(totals.profit))}
            </span>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  active,
  onClick,
  negative,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
  negative?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 text-left bg-[var(--surface-card)] rounded-[12px] px-3.5 py-2.5 active:scale-[0.99] transition ${
        active ? "" : "shadow-[var(--shadow-card)]"
      }`}
      style={active ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[12px] font-semibold text-[var(--label-secondary)]">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>
        {negative && value > 0 ? "−" : ""}
        {formatEUR(value)}
      </div>
    </button>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.6" stroke="var(--label-secondary)" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="var(--label-secondary)" strokeWidth="1.7" />
      <circle cx="16.5" cy="14.5" r="1.15" fill="var(--label-secondary)" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="8" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 ml-0.5" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
