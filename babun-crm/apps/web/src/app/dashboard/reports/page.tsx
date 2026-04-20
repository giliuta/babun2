"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { loadBrigades, type Brigade } from "@/lib/brigades";
import { loadExpenses } from "@/lib/expenses";
import { loadPayments } from "@/lib/payments";
import { formatEUR, formatEURSigned } from "@/lib/money";
import {
  useAppointments,
  useDayExtras,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import { computeFinancials, type FinanceLine } from "@/lib/finance/compute";

// ─── Period helpers ─────────────────────────────────────────────────────────

type PeriodKey =
  | "today" | "yesterday"
  | "this_week" | "last_week"
  | "this_month" | "last_month"
  | "this_year" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today",       label: "Сегодня" },
  { key: "yesterday",   label: "Вчера" },
  { key: "this_week",   label: "Эта неделя" },
  { key: "last_week",   label: "Прошлая неделя" },
  { key: "this_month",  label: "Этот месяц" },
  { key: "last_month",  label: "Прошлый месяц" },
  { key: "this_year",   label: "Этот год" },
  { key: "all",         label: "Весь период" },
];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function todayKey(): string { return fmtDate(new Date()); }

function getDateRange(period: PeriodKey): { from: string; to: string } | null {
  const today = new Date();
  if (period === "all") return null;
  if (period === "today") { const t = fmtDate(today); return { from: t, to: t }; }
  if (period === "yesterday") { const y = fmtDate(addDays(today, -1)); return { from: y, to: y }; }
  const dow = today.getDay();
  const diffMon = dow === 0 ? -6 : 1 - dow;
  if (period === "this_week") {
    const mon = addDays(today, diffMon);
    return { from: fmtDate(mon), to: fmtDate(addDays(mon, 6)) };
  }
  if (period === "last_week") {
    const mon = addDays(today, diffMon - 7);
    return { from: fmtDate(mon), to: fmtDate(addDays(mon, 6)) };
  }
  if (period === "this_month") {
    return {
      from: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to:   fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (period === "last_month") {
    return {
      from: fmtDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to:   fmtDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (period === "this_year") {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return null;
}

// ─── Day row type ────────────────────────────────────────────────────────────

interface DayRow {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

// ─── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  color,
  signed,
}: {
  label: string;
  amount: number;
  color: "emerald" | "rose" | "indigo";
  signed?: boolean;
}) {
  const colorClass =
    color === "emerald" ? "text-emerald-600" :
    color === "rose" ? "text-rose-600" : "text-indigo-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-3 flex-1 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums mt-0.5 ${colorClass}`}>
        {signed ? formatEURSigned(amount) : formatEUR(amount)}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [activeBrigade, setActiveBrigade] = useState<string>("all");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const { appointments } = useAppointments();
  const { getExtrasFor } = useDayExtras();
  const { services } = useServices();
  const { teams } = useTeams();
  const { clients } = useClients();

  const reload = useCallback(() => {
    setBrigades(loadBrigades());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const range = useMemo(() => getDateRange(period), [period]);

  const clientsById = useMemo(() => {
    const map = new Map<string, { full_name: string }>();
    for (const c of clients) map.set(c.id, { full_name: c.full_name });
    return map;
  }, [clients]);

  // Same compute function used by /dashboard/finances — single source of
  // truth. Brigades on /reports are actually teams in the data layer;
  // the standalone-FinancePayment "brigadeId" field plays the same role.
  const { incomeLines, expenseLines, totalIncome, totalExpense, profit } = useMemo(
    () =>
      computeFinancials({
        appointments,
        services,
        teams,
        dayExtrasOf: getExtrasFor,
        standalonePayments: loadPayments(),
        standaloneExpenses: loadExpenses(),
        clientsById,
        range: { from: range?.from ?? null, to: range?.to ?? todayKey() },
        teamFilter: activeBrigade,
      }),
    [appointments, services, teams, getExtrasFor, clientsById, range, activeBrigade]
  );
  const totalProfit = profit;

  const dayRows = useMemo<DayRow[]>(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const l of incomeLines) {
      const row = map.get(l.dateKey) ?? { income: 0, expense: 0 };
      row.income += l.amount;
      map.set(l.dateKey, row);
    }
    for (const l of expenseLines) {
      const row = map.get(l.dateKey) ?? { income: 0, expense: 0 };
      row.expense += l.amount;
      map.set(l.dateKey, row);
    }
    return Array.from(map.entries())
      .map(([date, { income, expense }]) => ({ date, income, expense, profit: income - expense }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [incomeLines, expenseLines]);

  const expandedIncome = useMemo<FinanceLine[]>(() => {
    if (!expandedDay) return [];
    return incomeLines.filter((l) => l.dateKey === expandedDay);
  }, [incomeLines, expandedDay]);

  const expandedExpense = useMemo<FinanceLine[]>(() => {
    if (!expandedDay) return [];
    return expenseLines.filter((l) => l.dateKey === expandedDay);
  }, [expenseLines, expandedDay]);

  const selectedLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  const hasData = totalIncome > 0 || totalExpense > 0;

  return (
    <>
      <PageHeader title="Отчёты" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Period selector */}
        <div className="relative bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPeriodMenu((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-gray-900"
          >
            {selectedLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {showPeriodMenu && (
            <div className="absolute top-full left-0 mt-0 bg-white shadow-lg rounded-b-xl z-20 w-52 border border-gray-200 border-t-0">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPeriod(p.key); setShowPeriodMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm ${period === p.key ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brigade tabs */}
        <div className="bg-white border-b border-gray-200 flex overflow-x-auto">
          {[{ id: "all", name: "Все" }, ...brigades].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBrigade(b.id)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeBrigade === b.id
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {/* Summary cards */}
          <div className="flex gap-2">
            <SummaryCard label="Доход" amount={totalIncome} color="emerald" />
            <SummaryCard label="Расход" amount={totalExpense} color="rose" />
            <SummaryCard label="Прибыль" amount={totalProfit} color="indigo" signed />
          </div>

          {/* Empty state */}
          {!hasData && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="text-3xl mb-2">📈</div>
              <div className="text-sm text-gray-500">Нет данных за выбранный период.</div>
              <div className="text-xs text-gray-400 mt-1">
                Добавьте выплаты в разделе Расходы, или создайте финансовые платежи.
              </div>
            </div>
          )}

          {/* Day table */}
          {dayRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <span>Дата</span>
                  <span className="text-right">Доход</span>
                  <span className="text-right">Расход</span>
                  <span className="text-right">Прибыль</span>
                </div>
              </div>

              {dayRows.map((row, i) => {
                const isExpanded = expandedDay === row.date;
                return (
                  <div key={row.date}>
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isExpanded ? null : row.date)}
                      className={`w-full grid grid-cols-4 gap-2 px-4 py-3 text-left ${
                        i < dayRows.length - 1 ? "border-b border-gray-100" : ""
                      } ${isExpanded ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                    >
                      <span className="text-[12px] text-gray-700">{row.date.slice(5)}</span>
                      <span className="text-[12px] font-medium text-emerald-600 tabular-nums text-right">
                        {row.income > 0 ? `+${formatEUR(row.income)}` : "—"}
                      </span>
                      <span className="text-[12px] font-medium text-rose-600 tabular-nums text-right">
                        {row.expense > 0 ? `−${formatEUR(row.expense)}` : "—"}
                      </span>
                      <span className={`text-[12px] font-bold tabular-nums text-right ${row.profit >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                        {formatEURSigned(row.profit)}
                      </span>
                    </button>

                    {/* Expanded day detail */}
                    {isExpanded && (
                      <div className="bg-indigo-50/60 border-b border-indigo-100 px-4 py-3 space-y-2">
                        {expandedIncome.map((l) => (
                          <div key={l.id} className="flex items-center gap-2 text-[12px]">
                            <span className="text-emerald-600">+</span>
                            <span className="flex-1 text-gray-700 truncate">{l.description}</span>
                            <span className="font-semibold text-emerald-600 tabular-nums">{formatEUR(l.amount)}</span>
                          </div>
                        ))}
                        {expandedExpense.map((l) => (
                          <div key={l.id} className="flex items-center gap-2 text-[12px]">
                            <span className="text-rose-600">−</span>
                            <span className="flex-1 text-gray-700 truncate">{l.description}</span>
                            <span className="font-semibold text-rose-600 tabular-nums">{formatEUR(l.amount)}</span>
                          </div>
                        ))}
                        {expandedIncome.length === 0 && expandedExpense.length === 0 && (
                          <div className="text-[11px] text-gray-400">Нет деталей</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Totals row */}
              <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                <span className="text-[12px] font-semibold text-gray-700">Итого</span>
                <span className="text-[12px] font-bold text-emerald-600 tabular-nums text-right">+{formatEUR(totalIncome)}</span>
                <span className="text-[12px] font-bold text-rose-600 tabular-nums text-right">−{formatEUR(totalExpense)}</span>
                <span className={`text-[12px] font-bold tabular-nums text-right ${totalProfit >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                  {formatEURSigned(totalProfit)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
