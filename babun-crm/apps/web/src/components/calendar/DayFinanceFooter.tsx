"use client";

import { memo } from "react";
import { formatDateKey } from "@babun/shared/common/utils/date-utils";
import { formatEUR } from "@babun/shared/common/utils/money";
import type {
  DayFinanceRowsConfig,
  DayFinanceTotals,
} from "@babun/shared/local/finance/day-summary";
import { anyRowEnabled } from "@babun/shared/local/finance/day-summary";

interface DayFinanceFooterProps {
  /** Same visible dates the calendar grid renders (1 / 3 / 7). */
  dates: Date[];
  rows: DayFinanceRowsConfig;
  summaryFor: (dateKey: string) => DayFinanceTotals;
  onDayTap: (dateKey: string) => void;
}

type RowKey = "planned" | "earned" | "spent" | "profit";

const ROW_META: Record<
  RowKey,
  { label: string; color: string; bold?: boolean }
> = {
  planned: { label: "План", color: "text-[var(--label-secondary)]" },
  earned: { label: "Зараб", color: "text-[var(--system-green)]" },
  spent: { label: "Расход", color: "text-[var(--system-red)]" },
  profit: { label: "Приб", color: "text-[var(--accent)]", bold: true },
};

// Fixed line height per row so columns line up even when some cells
// show «—». Tiny + muted: the footer must read as a quiet ledger, not
// compete with the appointment cards above.
const LINE = "h-[15px] leading-[15px] text-[11px] tabular-nums";

function cellValue(key: RowKey, t: DayFinanceTotals): string {
  const v =
    key === "planned"
      ? t.planned
      : key === "earned"
        ? t.earned
        : key === "spent"
          ? t.spent
          : t.profit;
  // Profit always renders (it's the bottom line); the others show «—»
  // when zero so empty days stay clean.
  if (key !== "profit" && v === 0) return "—";
  return formatEUR(v);
}

function DayFinanceFooterInner({
  dates,
  rows,
  summaryFor,
  onDayTap,
}: DayFinanceFooterProps) {
  if (!anyRowEnabled(rows)) return null;

  const activeRows = (Object.keys(ROW_META) as RowKey[]).filter(
    (k) => rows[k],
  );

  return (
    <div
      data-testid="day-finance-footer"
      className="flex-shrink-0 flex w-full border-t border-[var(--separator)] bg-[var(--surface-card)] select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Row-label gutter — aligns with the TimeColumn width (w-12/16). */}
      <div className="w-12 lg:w-16 flex-shrink-0 flex flex-col justify-center py-1.5 pr-1">
        {activeRows.map((k) => (
          <div
            key={k}
            className={`${LINE} text-right uppercase tracking-wide text-[9px] text-[var(--label-tertiary)] font-semibold`}
          >
            {ROW_META[k].label}
          </div>
        ))}
      </div>

      {/* One tappable column per visible day. */}
      {dates.map((date) => {
        const dateKey = formatDateKey(date);
        const totals = summaryFor(dateKey);
        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onDayTap(dateKey)}
            aria-label={`Финансы за ${dateKey}`}
            className="flex-1 min-w-0 flex flex-col justify-center py-1.5 px-0.5 border-l border-[var(--separator)] first:border-l-0 active:bg-[var(--fill-quaternary)] transition-colors"
          >
            {activeRows.map((k) => {
              const meta = ROW_META[k];
              const negativeProfit = k === "profit" && totals.profit < 0;
              return (
                <div
                  key={k}
                  className={`${LINE} text-center truncate ${
                    negativeProfit ? "text-[var(--system-red)]" : meta.color
                  } ${meta.bold ? "font-bold" : "font-semibold"}`}
                >
                  {cellValue(k, totals)}
                </div>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}

const DayFinanceFooter = memo(DayFinanceFooterInner);
export default DayFinanceFooter;
