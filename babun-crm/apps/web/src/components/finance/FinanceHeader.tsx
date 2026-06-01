"use client";

// Sticky header for /finances: brigade chips (multi-select) + period
// switcher + the 2-tile banner (Доход / Расход) with inline secondary
// metrics (Прибыль · Ожидаемая · Долг).

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Team } from "@babun/shared/local/masters";
import PeriodPicker from "./PeriodPicker";
import type { PeriodKind, PeriodRange } from "@/lib/finance/period";
import type { PeriodTotals } from "@/lib/finance/ledger-compute";

interface FinanceHeaderProps {
  teams: Team[];
  selectedBrigadeIds: string[]; // empty = «Все бригады»
  onToggleBrigade: (brigadeId: string) => void;
  onResetBrigades: () => void;
  period: PeriodKind;
  onPeriodChange: (kind: PeriodKind) => void;
  range: PeriodRange;
  onCustomRange: (range: PeriodRange) => void;
  totals: PeriodTotals;
}

export default function FinanceHeader({
  teams,
  selectedBrigadeIds,
  onToggleBrigade,
  onResetBrigades,
  period,
  onPeriodChange,
  range,
  onCustomRange,
  totals,
}: FinanceHeaderProps) {
  const allActive = selectedBrigadeIds.length === 0;

  return (
    <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)] px-3 pt-2 pb-2 space-y-2">
      {/* Brigade chips */}
      <div className="flex gap-1.5 overflow-x-auto">
        <BrigadeChip label="Все бригады" active={allActive} onClick={onResetBrigades} />
        {teams.map((t) => (
          <BrigadeChip
            key={t.id}
            label={t.name}
            color={t.color}
            active={selectedBrigadeIds.includes(t.id)}
            onClick={() => onToggleBrigade(t.id)}
          />
        ))}
      </div>

      {/* Period switcher */}
      <PeriodPicker
        value={period}
        onChange={onPeriodChange}
        range={range}
        onCustomRange={onCustomRange}
      />

      {/* Banner — 2 big tiles + inline secondary metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Доход" value={totals.income} tone="green" />
        <Tile label="Расход" value={totals.expense} tone="red" />
      </div>
      <div className="text-[12px] text-[var(--label-tertiary)] tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Прибыль{" "}
          <span
            className={`font-semibold ${
              totals.profit < 0
                ? "text-[var(--system-red)]"
                : "text-[var(--label)]"
            }`}
          >
            {formatEUR(totals.profit)}
          </span>
        </span>
        <span>·</span>
        <span>
          Ожидаемая{" "}
          <span className="font-semibold text-[var(--label-secondary)]">
            {formatEUR(totals.expectedProfit)}
          </span>
        </span>
        {totals.debt > 0 && (
          <>
            <span>·</span>
            <span>
              Долг{" "}
              <span className="font-semibold text-[var(--system-orange)]">
                {formatEUR(totals.debt)}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function BrigadeChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 h-7 px-3 rounded-full text-[12px] font-semibold border inline-flex items-center gap-1.5 transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent"
          : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
      }`}
    >
      {color && (
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red";
}) {
  const color =
    tone === "green" ? "text-[var(--system-green)]" : "text-[var(--system-red)]";
  return (
    <div className="bg-[var(--fill-tertiary)] rounded-[10px] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--label-tertiary)] font-semibold">
        {label}
      </div>
      <div className={`text-[20px] font-bold tabular-nums leading-tight mt-0.5 ${color}`}>
        {tone === "red" && value > 0 ? "−" : ""}
        {formatEUR(value)}
      </div>
    </div>
  );
}
