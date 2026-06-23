"use client";

// Analytics popup (📊) — mockup lines 641-742, minus the deferred
// VAT/payroll cards. Profit hero + income-by-service pie +
// profit-by-brigade bars + expense-by-category bars + accounts/debt
// summary. Scoped metrics (hero, pie, expense categories) use the
// active team's transactions; the per-brigade section spans all teams,
// matching the mockup's `byBrigade` over `S.txs`.

import { useMemo } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import FinancePieChart, { type FinancePieEntry } from "./FinancePieChart";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  breakdownByBrigade,
  type PeriodTotals,
} from "@/lib/finance/ledger-compute";
import {
  buildCsv,
  downloadCsv,
  FINANCE_CSV_COLUMNS,
  type FinanceCsvRow,
} from "@/lib/finance/csv-export";
import type { PeriodRange } from "@/lib/finance/period";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Team } from "@babun/shared/local/masters";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import type { Service } from "@babun/shared/local/services";
import type { Appointment } from "@babun/shared/local/appointments";

const PROFIT_COLOR = "#34AADC"; // locked: прибыль is always light-blue

interface AnalyticsSheetProps {
  open: boolean;
  onClose: () => void;
  scopeLabel: string;
  range: PeriodRange;
  totals: PeriodTotals;
  acctTotal: number;
  /** Active-team transactions (hero count, pie, expense categories). */
  scopedTx: FinanceTransaction[];
  /** All-team transactions in period (profit-by-brigade section). */
  allTeamTx: FinanceTransaction[];
  teams: Team[];
  categories: FinanceCategory[];
  services: Service[];
  appointments: Appointment[];
  onBrigadeTap?: (teamId: string) => void;
}

export default function AnalyticsSheet({
  open,
  onClose,
  scopeLabel,
  range,
  totals,
  acctTotal,
  scopedTx,
  allTeamTx,
  teams,
  categories,
  services,
  appointments,
  onBrigadeTap,
}: AnalyticsSheetProps) {
  const pieEntries = useMemo<FinancePieEntry[]>(() => {
    const map = new Map<string, number>();
    for (const t of scopedTx) {
      if (t.type !== "income") continue;
      const label = incomeLabel(t, categories, services, appointments);
      map.set(label, (map.get(label) ?? 0) + t.amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      id: name,
      name,
      value,
    }));
  }, [scopedTx, categories, services, appointments]);

  const brigadeRows = useMemo(
    () => breakdownByBrigade(allTeamTx, teams.map((t) => t.id)),
    [allTeamTx, teams],
  );
  const maxProfit = Math.max(1, ...brigadeRows.map((r) => Math.abs(r.profit)));

  const expenseCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of scopedTx) {
      if (t.type !== "expense") continue;
      const name =
        (t.category_id &&
          categories.find((c) => c.id === t.category_id)?.name) ||
        t.notes ||
        "Прочее";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedTx, categories]);
  const maxCat = Math.max(1, ...expenseCats.map((c) => c.amount));

  const handleExportCsv = () => {
    const teamName = (id: string | null) =>
      (id && teams.find((t) => t.id === id)?.name) || "—";
    const rows: FinanceCsvRow[] = scopedTx
      .filter((t) => t.type === "income" || t.type === "expense" || t.type === "refund")
      .map((t) => ({
        dateKey: t.occurred_on,
        type: t.type === "expense" ? "expense" : "income",
        teamName: teamName(t.team_id),
        description:
          t.type === "expense"
            ? (t.category_id && categories.find((c) => c.id === t.category_id)?.name) ||
              t.notes ||
              "Расход"
            : t.type === "refund"
              ? `Возврат: ${incomeLabel(t, categories, services, appointments)}`
              : incomeLabel(t, categories, services, appointments),
        amount: t.amount,
      }));
    const csv = buildCsv(FINANCE_CSV_COLUMNS, rows);
    downloadCsv(csv, `finance-${range.from}_${range.to}`);
  };

  if (!open) return null;

  return (
    <DialogModal open={open} onClose={onClose} title="Аналитика">
      <div className="px-3 py-3 space-y-3 bg-[var(--surface-grouped)]">
        <div className="text-[12px] text-[var(--label-secondary)] px-1">
          {scopeLabel} · {formatRange(range)}
        </div>

        {/* Profit hero */}
        <div className="bg-[var(--surface-card)] rounded-[16px] shadow-[var(--shadow-card)] p-4">
          <div className="text-[12px] text-[var(--label-secondary)]">Прибыль</div>
          <div
            className="text-[30px] font-bold tabular-nums leading-tight"
            style={{ color: PROFIT_COLOR }}
          >
            {totals.profit >= 0 ? "+" : "−"}
            {formatEUR(Math.abs(totals.profit))}
          </div>
          <div className="flex mt-3 pt-3 border-t border-[var(--separator)]">
            <HeroCell label="Доход" value={formatEUR(totals.income)} color="var(--system-green)" />
            <HeroCell label="Расход" value={formatEUR(totals.expense)} color="var(--system-red)" />
            <HeroCell label="Операций" value={String(scopedTx.length)} />
          </div>
        </div>

        {/* Доходы по услугам */}
        <FinancePieChart title="Доходы по услугам" entries={pieEntries} formatEur={formatEUR} />

        {/* Прибыль по бригадам */}
        <Section title="Прибыль по бригадам">
          {brigadeRows.map((r, i) => {
            const team = teams.find((t) => t.id === r.brigade_id);
            if (!team) return null;
            const pct = Math.round((Math.abs(r.profit) / maxProfit) * 100);
            return (
              <button
                key={r.brigade_id}
                type="button"
                onClick={() => onBrigadeTap?.(r.brigade_id)}
                className={`w-full text-left py-2.5 active:opacity-70 transition ${
                  i > 0 ? "border-t border-[var(--separator)]" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                    {team.name}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: PROFIT_COLOR }}>
                    {r.profit >= 0 ? "+" : "−"}
                    {formatEUR(Math.abs(r.profit))}
                  </span>
                </div>
                <div className="h-[7px] rounded-full bg-[var(--fill-tertiary)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team.color }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[12px] text-[var(--label-tertiary)]">
                  <span>Доход {formatEUR(r.income)}</span>
                  <span>Расход {formatEUR(r.expense)}</span>
                </div>
              </button>
            );
          })}
        </Section>

        {/* Расходы по категориям */}
        <Section title="Расходы по категориям">
          {expenseCats.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[var(--label-tertiary)]">
              Нет расходов за период
            </div>
          ) : (
            expenseCats.map((c, i) => {
              const pct = Math.round((c.amount / maxCat) * 100);
              return (
                <div key={c.name} className={i > 0 ? "py-2 border-t border-[var(--separator)]" : "py-2"}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[14px]">{c.name}</span>
                    <span className="text-[14px] font-semibold tabular-nums">{formatEUR(c.amount)}</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-[var(--fill-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "var(--system-red)", opacity: 0.55 }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </Section>

        {/* Accounts + debt summary */}
        <div className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-card)] overflow-hidden">
          <SummaryRow label="Всего на счетах" value={formatEUR(acctTotal)} />
          <SummaryRow
            label="Долги клиентов"
            value={formatEUR(totals.debt)}
            valueColor="var(--system-orange)"
            border
          />
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full h-11 rounded-[var(--radius-pill)] text-[13px] font-semibold border border-[var(--separator)] bg-[var(--surface-card)] text-[var(--label)] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          ⬇ Экспорт в CSV (Excel)
        </button>
      </div>
    </DialogModal>
  );
}

function HeroCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1">
      <div className="text-[11px] uppercase tracking-wide text-[var(--label-tertiary)]">{label}</div>
      <div className="text-[18px] font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-semibold uppercase tracking-wide text-[var(--label-secondary)] mb-2 px-1">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-card)] px-4 py-1.5">
        {children}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  border,
}: {
  label: string;
  value: string;
  valueColor?: string;
  border?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between min-h-[50px] px-4 ${
        border ? "border-t border-[var(--separator)]" : ""
      }`}
    >
      <span className="text-[14px] text-[var(--label-secondary)]">{label}</span>
      <span className="text-[16px] font-bold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function incomeLabel(
  t: FinanceTransaction,
  categories: FinanceCategory[],
  services: Service[],
  appointments: Appointment[],
): string {
  if (t.category_id) {
    const c = categories.find((x) => x.id === t.category_id);
    if (c) return c.name;
  }
  if (t.appointment_id) {
    const a = appointments.find((x) => x.id === t.appointment_id);
    const sid = a?.service_ids?.[0];
    if (sid) {
      const s = services.find((x) => x.id === sid);
      if (s) return s.name;
    }
  }
  return "Доход";
}

const RU_MONTHS_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек.",
];
function dmy(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`;
}
function formatRange(range: PeriodRange): string {
  if (range.from === range.to) return dmy(range.from);
  return `${dmy(range.from)} – ${dmy(range.to)}`;
}
