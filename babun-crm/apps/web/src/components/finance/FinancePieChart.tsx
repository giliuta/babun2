"use client";

// P1 #28 (CRM Core brief) — top-N revenue pie for the finance page.
//
// Companion to FinanceSparkline (per-day bars). Same philosophy:
// raw SVG, zero deps. recharts would buy us tooltips and a legend
// for ~120 kB; for a 5-slice pie that lives next to a clearly
// labelled list, the cost isn't worth it.
//
// Slices auto-collapse anything past the top N into a single
// «Прочее» wedge so a long-tail clientele doesn't fragment the
// chart into invisible 1° slivers.
//
// Caller passes pre-computed entries; the component does no math
// beyond proportions + the path string.

import { useMemo } from "react";

export interface FinancePieEntry {
  /** Key for stable React id + accessible label. */
  id: string;
  /** Russian-side label shown in the legend (next to a coloured dot). */
  name: string;
  /** Revenue contribution in EUR. Negatives are clamped to zero so
   *  expenses-flavoured data passed by mistake doesn't carve a void
   *  out of the chart. */
  value: number;
}

interface Props {
  entries: FinancePieEntry[];
  /** How many real wedges to show before collapsing the rest into
   *  «Прочее». Default 5 — matches what the brief calls out. */
  topN?: number;
  /** Pixel diameter. Component renders square. Default 140. */
  size?: number;
  /** Section title above the chart. */
  title?: string;
  /** Optional subtitle (e.g. «За месяц»). */
  subtitle?: string;
  /** Total formatter — pass `formatEUR` for consistency with the rest
   *  of the finance UI. Falls back to `Math.round + " €"`. */
  formatEur?: (eur: number) => string;
}

// iOS system palette aligned with the rest of the app. Chosen so that
// consecutive wedges read as visually distinct even at small sizes.
const PALETTE = [
  "#34C759", // green
  "#007AFF", // blue
  "#FF9500", // orange
  "#AF52DE", // purple
  "#5AC8FA", // sky
  "#FFCC00", // yellow
];
const REST_COLOR = "#8E8E93"; // system grey for «Прочее»

export default function FinancePieChart({
  entries,
  topN = 5,
  size = 140,
  title,
  subtitle,
  formatEur,
}: Props) {
  const fmt = formatEur ?? ((v: number) => `${Math.round(v)} €`);

  const slices = useMemo(() => {
    // Drop negatives, sort descending, collapse the tail.
    const cleaned = entries
      .map((e) => ({ ...e, value: Math.max(0, e.value) }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    if (cleaned.length <= topN) {
      return cleaned.map((e, i) => ({
        ...e,
        color: PALETTE[i % PALETTE.length],
        rest: false,
      }));
    }
    const head = cleaned.slice(0, topN);
    const tail = cleaned.slice(topN);
    const tailTotal = tail.reduce((s, e) => s + e.value, 0);
    return [
      ...head.map((e, i) => ({
        ...e,
        color: PALETTE[i % PALETTE.length],
        rest: false as const,
      })),
      tailTotal > 0
        ? {
            id: "__rest__",
            name: `Прочее (${tail.length})`,
            value: tailTotal,
            color: REST_COLOR,
            rest: true as const,
          }
        : null,
    ].filter((s): s is NonNullable<typeof s> => s !== null);
  }, [entries, topN]);

  const total = slices.reduce((s, e) => s + e.value, 0);

  if (slices.length === 0 || total === 0) {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
        {title && (
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
            {title}
          </div>
        )}
        <div className="text-[13px] text-[var(--label-tertiary)] py-6 text-center">
          Нет данных за выбранный период.
        </div>
      </div>
    );
  }

  // Single-slice fallback: SVG arc with 360° angle paints nothing.
  // Render a filled circle instead.
  const singleSlice = slices.length === 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  let cumulative = 0;
  const paths = singleSlice
    ? null
    : slices.map((slice) => {
        const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
        const endAngle =
          ((cumulative + slice.value) / total) * Math.PI * 2 - Math.PI / 2;
        cumulative += slice.value;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = slice.value / total > 0.5 ? 1 : 0;
        const d = [
          `M ${cx} ${cy}`,
          `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
          `A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
          "Z",
        ].join(" ");
        return { d, color: slice.color, id: slice.id };
      });

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      {title && (
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-[var(--label-tertiary)]">
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
          role="img"
          aria-label={title ?? "Распределение"}
        >
          {singleSlice ? (
            <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
          ) : (
            paths!.map((p) => <path key={p.id} d={p.d} fill={p.color} />)
          )}
        </svg>
        <ul className="flex-1 min-w-0 space-y-1.5">
          {slices.map((slice) => {
            const pct = (slice.value / total) * 100;
            return (
              <li
                key={slice.id}
                className="flex items-center gap-2 text-[12px] tabular-nums"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: slice.color }}
                />
                <span className="flex-1 min-w-0 truncate text-[var(--label)]">
                  {slice.name}
                </span>
                <span className="text-[var(--label-secondary)]">
                  {pct.toFixed(0)}%
                </span>
                <span className="font-semibold text-[var(--label)] shrink-0 w-16 text-right">
                  {fmt(slice.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
