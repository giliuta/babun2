"use client";

// Finances home overview (the approved mockup): single-team chips +
// period + «Счета» mini-card + Доход/Расход + Долги|Прибыль row.
// Tapping a metric tells the parent which panel to show below.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Team } from "@babun/shared/local/masters";
import type { PeriodTotals } from "@/lib/finance/ledger-compute";
import PeriodPicker from "./PeriodPicker";
import type { PeriodKind, PeriodRange } from "@/lib/finance/period";

export type HomeView = "all" | "accounts" | "income" | "expense" | "debt";

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
}: FinanceOverviewProps) {
  return (
    <>
      {/* Team chips + period — sticky header band */}
      <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)] px-3 pt-2 pb-2 space-y-2">
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
      <div className="bg-[var(--surface-grouped)] px-4 pt-3 space-y-2.5">
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

        {/* Доход / Расход */}
        <div className="flex bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)]">
          <MetricCell
            label="Доход"
            value={totals.income}
            color="var(--system-green)"
            active={view === "income"}
            activeBg="rgba(52,199,89,0.18)"
            idleBg="rgba(52,199,89,0.05)"
            onClick={onTapIncome}
          />
          <div className="w-px bg-[var(--separator)] my-2.5" />
          <MetricCell
            label="Расход"
            value={totals.expense}
            color="var(--system-red)"
            active={view === "expense"}
            activeBg="rgba(255,59,48,0.16)"
            idleBg="rgba(255,59,48,0.045)"
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
          <div className="flex-1 flex items-center gap-2 rounded-[12px] px-3.5 py-2.5" style={{ backgroundColor: "rgba(52,170,220,0.10)" }}>
            <span className="text-[14px] font-semibold" style={{ color: PROFIT_COLOR }}>
              Прибыль
            </span>
            <span className="ml-auto text-[15px] font-bold tabular-nums" style={{ color: PROFIT_COLOR }}>
              {totals.profit >= 0 ? "+" : "−"}
              {formatEUR(Math.abs(totals.profit))}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function MetricCell({
  label,
  value,
  color,
  active,
  activeBg,
  idleBg,
  onClick,
  negative,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  activeBg: string;
  idleBg: string;
  onClick: () => void;
  negative?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 px-4 pt-3 pb-3.5 text-left active:scale-[0.99] transition"
      style={{ backgroundColor: active ? activeBg : idleBg }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
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
