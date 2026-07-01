"use client";

// «Разбор прибыли» — inline panel shown below the overview when the user
// taps «Прибыль» (like the Доход/Расход/Долги panels). Two breakdowns:
// «Что принесло денег» (income by service) and «Куда ушёл расход»
// (expense by category), each row with its operation count (×N). A
// «Списком / Доли %» toggle flips the rows to a conic-gradient donut +
// percentage legend. Mirrors the locked mockup (finances-design.html).

import { useMemo, useState } from "react";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  breakdownIncome,
  breakdownExpense,
  type BreakdownRow,
} from "@/lib/finance/breakdown";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import type { Service } from "@babun/shared/local/services";
import type { Appointment } from "@babun/shared/local/appointments";

// Green-led / red-led palettes from the locked mockup (_IPAL / _EPAL).
const INCOME_PALETTE = ["#34C759", "#3E88F7", "#5E5CE6", "#00C7BE", "#FFCC00", "#FF7A00"];
const EXPENSE_PALETTE = ["#FF3B30", "#FF9500", "#FF2D55", "#8E8E93", "#5E5CE6", "#FFCC00"];

type ProfitView = "bars" | "chart";

interface ProfitPanelProps {
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  services: Service[];
  appointments: Appointment[];
}

export default function ProfitPanel({
  transactions,
  categories,
  services,
  appointments,
}: ProfitPanelProps) {
  const [view, setView] = useState<ProfitView>("bars");

  const incomeRows = useMemo(
    () => breakdownIncome(transactions, categories, services, appointments),
    [transactions, categories, services, appointments],
  );
  const expenseRows = useMemo(
    () => breakdownExpense(transactions, categories),
    [transactions, categories],
  );
  const incomeTotal = incomeRows.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expenseRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="px-3 pt-3">
      {/* Title + Списком / Доли % toggle */}
      <div className="flex items-center mb-2 px-1 min-h-[30px]">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--label-secondary)]">
          Разбор прибыли
        </span>
        <div className="ml-auto inline-flex bg-[var(--fill-tertiary)] rounded-[8px] p-0.5 gap-0.5">
          <ToggleButton active={view === "bars"} onClick={() => setView("bars")} label="Списком">
            <BarsIcon />
          </ToggleButton>
          <ToggleButton active={view === "chart"} onClick={() => setView("chart")} label="Доли в процентах">
            <PieIcon />
          </ToggleButton>
        </div>
      </div>

      <div className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-card)] px-4 pt-3.5 pb-2.5">
        <BreakdownSection
          title="Что принесло денег"
          kind="income"
          total={incomeTotal}
          rows={incomeRows}
          palette={INCOME_PALETTE}
          view={view}
          empty="Нет доходов за период"
        />
        <div className="h-px bg-[var(--separator)] my-3.5" />
        <BreakdownSection
          title="Куда ушёл расход"
          kind="expense"
          total={expenseTotal}
          rows={expenseRows}
          palette={EXPENSE_PALETTE}
          view={view}
          empty="Нет расходов за период"
        />
      </div>
    </div>
  );
}

const GREEN = "var(--system-green)";
const RED = "var(--system-red)";

// Expense amounts are stored positive but represent outflows → always
// «−». Income buckets are normally «+»; a refund whose original sale is
// outside the period can leave a negative «Возвраты» bucket → render it
// as a red «−» giveback.
function signOf(kind: "income" | "expense", amount: number): "+" | "−" {
  if (kind === "expense") return "−";
  return amount >= 0 ? "+" : "−";
}
function colorOf(kind: "income" | "expense", amount: number): string {
  if (kind === "expense") return RED;
  return amount >= 0 ? GREEN : RED;
}

function BreakdownSection({
  title,
  kind,
  total,
  rows,
  palette,
  view,
  empty,
}: {
  title: string;
  kind: "income" | "expense";
  total: number;
  rows: BreakdownRow[];
  palette: string[];
  view: ProfitView;
  empty: string;
}) {
  // The donut shows positive contributors only — a negative giveback
  // («Возвраты») can't carve a slice. Percentages are of that positive
  // base; negatives are still listed below the slices as «−€X» so the
  // donut never silently hides money that left.
  const pieRows = rows.filter((r) => r.amount > 0);
  const negRows = rows.filter((r) => r.amount < 0);
  const pieTotal = pieRows.reduce((s, r) => s + r.amount, 0) || 1;

  return (
    <div>
      <div className="flex items-baseline mb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-secondary)]">
          {title}
        </span>
        <span
          className="ml-auto text-[14px] font-bold tabular-nums"
          style={{ color: colorOf(kind, total) }}
        >
          {signOf(kind, total)}
          {formatEUR(Math.abs(total))}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="text-[13px] text-[var(--label-tertiary)] py-1.5">{empty}</div>
      ) : view === "bars" ? (
        rows.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center py-2.5 ${
              i > 0 ? "border-t border-[var(--separator)]" : ""
            }`}
          >
            <span className="text-[15px] text-[var(--label)] truncate">{r.name}</span>
            {r.count > 0 && (
              <span className="text-[12px] text-[var(--label-tertiary)] ml-2 flex-none">
                ×{r.count}
              </span>
            )}
            <span
              className="ml-auto pl-2.5 text-[15px] font-semibold tabular-nums flex-none"
              style={{ color: colorOf(kind, r.amount) }}
            >
              {signOf(kind, r.amount)}
              {formatEUR(Math.abs(r.amount))}
            </span>
          </div>
        ))
      ) : (
        <div className="flex items-center gap-3.5 py-1">
          {pieRows.length > 0 && <Donut rows={pieRows} palette={palette} total={pieTotal} />}
          <ul className="flex-1 min-w-0 space-y-0.5">
            {pieRows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2 py-0.5 min-w-0">
                <span
                  className="w-[9px] h-[9px] rounded-[2px] flex-none"
                  style={{ background: palette[i % palette.length] }}
                />
                <span className="text-[13px] text-[var(--label)] truncate">{r.name}</span>
                {r.count > 0 && (
                  <span className="text-[11px] text-[var(--label-tertiary)] flex-none">
                    ×{r.count}
                  </span>
                )}
                <span
                  className="ml-auto text-[13px] font-bold tabular-nums flex-none"
                  style={{ color: kind === "expense" ? RED : GREEN }}
                >
                  {Math.round((r.amount / pieTotal) * 100)}%
                </span>
              </li>
            ))}
            {negRows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-0.5 min-w-0">
                <span className="w-[9px] h-[9px] rounded-[2px] flex-none bg-[var(--label-tertiary)]" />
                <span className="text-[13px] text-[var(--label)] truncate">{r.name}</span>
                {r.count > 0 && (
                  <span className="text-[11px] text-[var(--label-tertiary)] flex-none">
                    ×{r.count}
                  </span>
                )}
                <span className="ml-auto text-[13px] font-bold tabular-nums flex-none" style={{ color: RED }}>
                  −{formatEUR(Math.abs(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Donut({
  rows,
  palette,
  total,
}: {
  rows: BreakdownRow[];
  palette: string[];
  total: number;
}) {
  const gradient = useMemo(() => {
    let cum = 0;
    const stops = rows.map((r, i) => {
      const p0 = cum;
      const p1 = cum + (r.amount / total) * 100;
      cum = p1;
      return `${palette[i % palette.length]} ${p0.toFixed(2)}% ${p1.toFixed(2)}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  }, [rows, palette, total]);

  return (
    <div className="relative w-[92px] h-[92px] flex-none">
      <div className="w-[92px] h-[92px] rounded-full" style={{ background: gradient }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54px] h-[54px] rounded-full bg-[var(--surface-card)]" />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center px-3 py-1.5 rounded-[7px] transition ${
        active
          ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
          : "text-[var(--label-tertiary)]"
      }`}
    >
      {children}
    </button>
  );
}

function BarsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function PieIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.5 12 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
