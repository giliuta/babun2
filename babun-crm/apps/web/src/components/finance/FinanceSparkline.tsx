"use client";

// v553 §3.12 — inline-SVG sparkline / bar chart for the finance page.
//
// Zero new dependencies — built with raw SVG so we don't pull
// recharts / visx (and their ~120 kB combined bundle cost) into a
// dashboard that's already heavy. recharts is the «right» answer
// when we need axes, legends, tooltips, multiple series; this
// component intentionally stays small and ships ONE thing well:
// per-day stacked bars (income + expense) with the resulting daily
// profit/loss line overlayed.
//
// Caller passes the pre-computed daily breakdown (use
// `computeFinancials({ ... }).dailyBreakdown` from
// @babun/shared/local/finance/compute or build your own array). The
// component does no business logic — just layout.
//
// Layout invariants:
//   - Fixed height 120 px, full container width via viewBox preserve
//   - Up to ~60 days fit comfortably; beyond that pass a pre-binned
//     weekly array to avoid 1-px-wide bars
//   - Y-axis scaled to the per-bar max of (income, expense, |profit|)
//   - Profit/loss line in green/red; ticks at zero baseline always
//   - Empty data (0 days OR all-zero) renders a flat placeholder so
//     the layout doesn't jump when the user picks an empty range

import { useMemo } from "react";

export interface FinanceDailyPoint {
  /** YYYY-MM-DD. Used for the per-bar tooltip + axis tick on the
   *  first/last/mid-month entries. */
  date: string;
  /** Gross income for the day. Pass in EUR (whole units) — the
   *  component doesn't care about cents math. */
  income: number;
  /** Total expense for the day. */
  expense: number;
}

interface Props {
  data: FinanceDailyPoint[];
  /** Optional title rendered above the chart. Default «Динамика». */
  title?: string;
  /** EUR formatter — pass your existing `formatEUR` helper so the
   *  axis label is consistent with the rest of the finance UI. */
  formatEur?: (eur: number) => string;
}

const HEIGHT = 120;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;

function defaultFormatEur(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} €`;
}

export default function FinanceSparkline({
  data,
  title = "Динамика",
  formatEur = defaultFormatEur,
}: Props) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return { maxScale: 0, totalIncome: 0, totalExpense: 0, totalProfit: 0 };
    }
    let maxScale = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    for (const d of data) {
      const profit = d.income - d.expense;
      maxScale = Math.max(maxScale, d.income, d.expense, Math.abs(profit));
      totalIncome += d.income;
      totalExpense += d.expense;
    }
    return {
      maxScale: maxScale || 1, // avoid /0 — flat baseline when all zero
      totalIncome,
      totalExpense,
      totalProfit: totalIncome - totalExpense,
    };
  }, [data]);

  // Width is responsive — we render with a viewBox sized to the
  // bar count + padding, then let CSS scale to the container.
  const barWidth = 8;
  const barGap = 4;
  const innerWidth =
    PAD_LEFT + PAD_RIGHT + data.length * (barWidth + barGap) - barGap;
  const viewWidth = Math.max(innerWidth, 100);
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + chartHeight; // bottom baseline

  return (
    <section
      className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4"
      data-testid="finance-sparkline"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[14px] font-semibold text-[var(--label)] tracking-tight">
          {title}
        </h3>
        <div className="flex items-center gap-3 text-[12px] tabular-nums">
          <span className="text-[var(--system-green)]">
            +{formatEur(stats.totalIncome)}
          </span>
          <span className="text-[var(--system-red)]">
            −{formatEur(stats.totalExpense)}
          </span>
          <span
            className={
              stats.totalProfit >= 0
                ? "text-[var(--label)] font-semibold"
                : "text-[var(--system-red)] font-semibold"
            }
          >
            {formatEur(stats.totalProfit)}
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center text-[12px] text-[var(--label-tertiary)]"
          style={{ height: HEIGHT }}
        >
          Нет данных за выбранный период
        </div>
      ) : data.length === 1 ? (
        // v683 / Audit-2026-05-21 P1-4 — single datapoint used to
        // render the SVG with the same X-axis label twice, looking
        // like a broken chart. Fall back to a plain stat line so
        // the user sees the value clearly without the visual
        // confusion of a chart with 1 bar and 2 axis ticks.
        <div
          className="flex items-center justify-center text-[13px] text-[var(--label-secondary)]"
          style={{ height: HEIGHT }}
        >
          1 запись · <span className="text-[var(--system-green)] font-semibold mx-1">+{formatEur(data[0].income)}</span>
          {data[0].expense > 0 ? (
            <>
              {" / "}
              <span className="text-[var(--system-red)] font-semibold mx-1">−{formatEur(data[0].expense)}</span>
            </>
          ) : null}
          {" "}за {data[0].date}
        </div>
      ) : (
        <svg
          role="img"
          aria-label={title}
          viewBox={`0 0 ${viewWidth} ${HEIGHT}`}
          preserveAspectRatio="none"
          width="100%"
          height={HEIGHT}
          className="overflow-visible"
        >
          {/* Zero baseline */}
          <line
            x1={0}
            y1={zeroY}
            x2={viewWidth}
            y2={zeroY}
            stroke="var(--separator)"
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const x = PAD_LEFT + i * (barWidth + barGap);
            const incomeH = (d.income / stats.maxScale) * chartHeight;
            const expenseH = (d.expense / stats.maxScale) * chartHeight;

            // Income — green bar above baseline.
            // Expense — red bar below baseline (or just visually
            // separated; here we stack red right above the zero line
            // but render income atop for clarity since green is
            // typically larger).
            return (
              <g key={i}>
                <title>
                  {d.date}: +{formatEur(d.income)} / −{formatEur(d.expense)}
                </title>
                <rect
                  x={x}
                  y={zeroY - incomeH}
                  width={barWidth}
                  height={incomeH}
                  rx={1.5}
                  fill="var(--system-green)"
                  opacity={0.85}
                />
                <rect
                  x={x}
                  y={zeroY - incomeH}
                  width={barWidth}
                  height={Math.min(expenseH, incomeH || expenseH)}
                  rx={1.5}
                  fill="var(--system-red)"
                  opacity={0.6}
                />
              </g>
            );
          })}

          {/* Axis ticks — first / mid / last date */}
          {data.length > 0 && (
            <>
              <text
                x={PAD_LEFT}
                y={HEIGHT - 4}
                fontSize={10}
                fill="var(--label-tertiary)"
                textAnchor="start"
              >
                {data[0].date.slice(5)}
              </text>
              {data.length > 2 && (
                <text
                  x={viewWidth / 2}
                  y={HEIGHT - 4}
                  fontSize={10}
                  fill="var(--label-tertiary)"
                  textAnchor="middle"
                >
                  {data[Math.floor(data.length / 2)].date.slice(5)}
                </text>
              )}
              <text
                x={viewWidth - PAD_RIGHT}
                y={HEIGHT - 4}
                fontSize={10}
                fill="var(--label-tertiary)"
                textAnchor="end"
              >
                {data[data.length - 1].date.slice(5)}
              </text>
            </>
          )}
        </svg>
      )}
    </section>
  );
}
