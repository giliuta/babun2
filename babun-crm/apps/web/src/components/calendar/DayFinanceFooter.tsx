"use client";

import { memo, useState } from "react";
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

// Footer metric mode. «all» = the full per-brigade row stack (v746).
// The single-metric modes collapse to one row across every day, and
// override the per-brigade toggles (you asked to see that metric).
type Metric = "all" | "profit" | "earned" | "planned";

const SEGMENTS: Array<{ key: Metric; label: string }> = [
  { key: "all", label: "Все" },
  { key: "profit", label: "Прибыль" },
  { key: "earned", label: "Доход" },
  { key: "planned", label: "План" },
];

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
  const [metric, setMetric] = useState<Metric>("all");

  // «all» honours the per-brigade toggles; a single metric always shows.
  if (metric === "all" && !anyRowEnabled(rows)) {
    // Nothing to show in the stacked view, but keep the switcher so the
    // user can still pull up a single metric.
    return (
      <div
        data-testid="day-finance-footer"
        className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--surface-card)] select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Switcher metric={metric} onChange={setMetric} />
      </div>
    );
  }

  const activeRows: RowKey[] =
    metric === "all"
      ? (Object.keys(ROW_META) as RowKey[]).filter((k) => rows[k])
      : [metric];

  return (
    <div
      data-testid="day-finance-footer"
      className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--surface-card)] select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Switcher metric={metric} onChange={setMetric} />

      <div className="flex w-full">
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
    </div>
  );
}

function Switcher({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (m: Metric) => void;
}) {
  return (
    <div className="mx-2 my-1 flex gap-0.5 bg-[var(--fill-tertiary)] rounded-[8px] p-0.5">
      {SEGMENTS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={`flex-1 h-6 rounded-[6px] text-[11px] font-semibold transition-colors ${
            metric === s.key
              ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const DayFinanceFooter = memo(DayFinanceFooterInner);
export default DayFinanceFooter;
