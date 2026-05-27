"use client";

import { memo } from "react";
import { formatDateKey } from "@babun/shared/common/utils/date-utils";
import { formatEUR } from "@babun/shared/common/utils/money";
import type {
  DayFinanceRowsConfig,
  DayFinanceTotals,
} from "@babun/shared/local/finance/day-summary";

interface DayFinanceFooterProps {
  /** Same visible dates the calendar grid renders (1 / 3 / 7). */
  dates: Date[];
  rows: DayFinanceRowsConfig;
  summaryFor: (dateKey: string) => DayFinanceTotals;
  onDayTap: (dateKey: string) => void;
}

// Two quiet lines per day — Доход (green) over Расход (red). No labels;
// colour carries the meaning. €0 cells are blank (not «—»), so empty
// days show nothing but the thin day separators — maximally clean.
// Everything else (план, прибыль, разбивка по оплате) lives in the
// per-day popup that opens on tap.
type LineKey = "earned" | "spent";

const LINES: Array<{ key: LineKey; color: string }> = [
  { key: "earned", color: "text-[var(--system-green)]" },
  { key: "spent", color: "text-[var(--system-red)]" },
];

// Fixed line height so columns line up even when a cell is blank.
const LINE = "h-[17px] leading-[17px] text-[12px] tabular-nums";

function cellValue(key: LineKey, t: DayFinanceTotals): string {
  const v = key === "earned" ? t.earned : t.spent;
  // €0 → blank (no dash): empty days stay completely clean, only the
  // thin day separators remain.
  return v === 0 ? "" : formatEUR(v);
}

function DayFinanceFooterInner({
  dates,
  rows,
  summaryFor,
  onDayTap,
}: DayFinanceFooterProps) {
  const activeLines = LINES.filter((l) => rows[l.key]);
  if (activeLines.length === 0) return null;

  return (
    <div
      data-testid="day-finance-footer"
      className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--surface-card)] select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex w-full">
        {/* Empty gutter — reserves the TimeColumn width (w-12/16) so the
            day columns line up with the grid above. No label. */}
        <div className="w-12 lg:w-16 flex-shrink-0" aria-hidden />

        {/* One tappable column per visible day → opens the detail popup. */}
        {dates.map((date) => {
          const dateKey = formatDateKey(date);
          const totals = summaryFor(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDayTap(dateKey)}
              aria-label={`Финансы за ${dateKey}`}
              className="flex-1 min-w-0 flex flex-col justify-center py-2 px-0.5 border-l border-[var(--separator)] first:border-l-0 active:bg-[var(--fill-quaternary)] transition-colors"
            >
              {activeLines.map((l) => (
                <div
                  key={l.key}
                  className={`${LINE} text-center truncate font-semibold ${l.color}`}
                >
                  {cellValue(l.key, totals)}
                </div>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DayFinanceFooter = memo(DayFinanceFooterInner);
export default DayFinanceFooter;
