"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useDayExtras,
  useExpenseCategories,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import {
  getPaidAmount,
  getDebtAmount,
  type Appointment,
} from "@/lib/appointments";
import { getServiceMaterialCost, type Service } from "@/lib/services";
import {
  createBlankExpenseCategory,
  type ExpenseCategory,
} from "@/lib/expense-categories";
import type { Client } from "@/lib/clients";
import { formatDateLongRu } from "@/lib/date-utils";
import {
  formatEUR,
  formatEURSigned,
  formatPercentDelta,
} from "@/lib/money";

// Unified Finance page.
// Single source of truth for the numbers:
//   – Income  = payments actually received on completed / in-progress
//               appointments + manual day-level income extras.
//   – Expense = per-service material cost + per-appointment custom
//               expense lines + manual day-level expense extras.
//   – Debt    = for completed appointments, total_amount − paid.
//   – Payroll = team's net (income − expense) × payout_percentage.
// Compared against the previous same-length window so Dima sees growth.

type Mode = "income" | "expenses" | "summary" | "debts" | "payroll";
type PeriodKey = "7d" | "30d" | "month" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "За последние 7 дней" },
  { key: "30d", label: "За последние 30 дней" },
  { key: "month", label: "За текущий месяц" },
  { key: "all", label: "За всё время" },
];

const MODE_LABELS: Record<Mode, string> = {
  income: "Доходы",
  expenses: "Расходы",
  summary: "Итого",
  debts: "Долги клиентов",
  payroll: "Зарплата бригад",
};

interface IncomeLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  sourceType: "appointment" | "extra";
  serviceIds: string[];
}

interface ExpenseLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  category: string;
  sourceType: "material" | "custom" | "extra";
}

interface DebtLine {
  id: string;
  clientId: string | null;
  clientName: string;
  dateKey: string;
  total: number;
  paid: number;
  debt: number;
  appointmentId: string;
}

export default function FinancesPage() {
  const router = useRouter();
  const { appointments } = useAppointments();
  const { getExtrasFor } = useDayExtras();
  const { categories, setCategories } = useExpenseCategories();
  const { services } = useServices();
  const { teams } = useTeams();
  const { clients } = useClients();

  const [mode, setMode] = useState<Mode>("summary");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [showCategories, setShowCategories] = useState(false);

  const teamTabs = useMemo(
    () => [
      { id: "all", name: "Все" },
      ...teams.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    ],
    [teams]
  );

  const teamById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const servicesById = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  // Current and previous period bounds (for comparison deltas).
  const current = useMemo(() => computeRange(period), [period]);
  const previous = useMemo(
    () => computePreviousRange(period, current),
    [period, current]
  );

  // Build income/expense lines for any date range.
  const buildLines = useMemo(() => {
    return (rangeStart: string | null, rangeEnd: string) => {
      const inRange = (k: string) =>
        rangeStart === null ? true : k >= rangeStart && k <= rangeEnd;

      const inc: IncomeLine[] = [];
      const exp: ExpenseLine[] = [];

      for (const apt of appointments) {
        if (apt.status !== "completed" && apt.status !== "in_progress") continue;
        if (!inRange(apt.date)) continue;

        const paid = getPaidAmount(apt);
        if (paid > 0) {
          const clientName =
            (apt.client_id && clientsById.get(apt.client_id)?.full_name) ||
            apt.comment ||
            "Запись";
          const serviceSummary = apt.service_ids
            .map((sid) => servicesById.get(sid)?.name)
            .filter(Boolean)
            .join(", ");
          inc.push({
            id: `apt-${apt.id}`,
            dateKey: apt.date,
            description: serviceSummary
              ? `${serviceSummary} — ${clientName}`
              : clientName,
            amount: paid,
            teamId: apt.team_id,
            sourceType: "appointment",
            serviceIds: apt.service_ids,
          });
        }

        for (const sid of apt.service_ids) {
          const svc = servicesById.get(sid);
          if (!svc) continue;
          const materialCost = getServiceMaterialCost(svc);
          if (materialCost > 0) {
            exp.push({
              id: `mat-${apt.id}-${sid}`,
              dateKey: apt.date,
              description: `Материалы: ${svc.name}`,
              amount: materialCost,
              teamId: apt.team_id,
              category: "Материалы",
              sourceType: "material",
            });
          }
        }

        for (const e of apt.expenses ?? []) {
          if (e.amount > 0) {
            exp.push({
              id: `cex-${apt.id}-${e.id}`,
              dateKey: apt.date,
              description: e.name || "Расход",
              amount: e.amount,
              teamId: apt.team_id,
              category: "Прочее",
              sourceType: "custom",
            });
          }
        }
      }

      const dateRange = datesInRange(rangeStart, rangeEnd);
      for (const team of teams) {
        for (const dateKey of dateRange) {
          const extras = getExtrasFor(team.id, dateKey);
          for (const ex of extras) {
            const base = {
              id: `ex-${team.id}-${dateKey}-${ex.id}`,
              dateKey,
              description: ex.name || (ex.kind === "income" ? "Доход" : "Расход"),
              amount: ex.amount,
              teamId: team.id,
            };
            if (ex.kind === "income") {
              inc.push({ ...base, sourceType: "extra", serviceIds: [] });
            } else {
              exp.push({ ...base, category: "Прочее", sourceType: "extra" });
            }
          }
        }
      }

      return { inc, exp };
    };
  }, [appointments, clientsById, servicesById, teams, getExtrasFor]);

  const curLines = useMemo(
    () => buildLines(current.rangeStart, current.rangeEnd),
    [buildLines, current]
  );
  const prevLines = useMemo(
    () => buildLines(previous.rangeStart, previous.rangeEnd),
    [buildLines, previous]
  );

  const applyTeam = <T extends { teamId: string | null }>(rows: T[]) =>
    activeTeam === "all" ? rows : rows.filter((r) => r.teamId === activeTeam);

  const filteredIncome = useMemo(
    () => applyTeam(curLines.inc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curLines.inc, activeTeam]
  );
  const filteredExpenses = useMemo(
    () => applyTeam(curLines.exp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curLines.exp, activeTeam]
  );
  const prevFilteredIncome = useMemo(
    () => applyTeam(prevLines.inc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevLines.inc, activeTeam]
  );
  const prevFilteredExpenses = useMemo(
    () => applyTeam(prevLines.exp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevLines.exp, activeTeam]
  );

  const totalIncome = sum(filteredIncome);
  const totalExpense = sum(filteredExpenses);
  const profit = totalIncome - totalExpense;
  const prevIncome = sum(prevFilteredIncome);
  const prevExpense = sum(prevFilteredExpenses);
  const prevProfit = prevIncome - prevExpense;

  // ─── STORY-003 cashbox reconciliation ─────────────────────────────
  // Разбиваем ДОХОД на нал / карта по фактическим payments в
  // appointments. ZP — расчётный % от дохода бригады (sum per team
  // если activeTeam === "all"). В кассе должно быть = нал − расход −
  // ЗП (упрощение: все расходы из нала).
  const cashbox = useMemo(() => {
    const inRange = (k: string) =>
      current.rangeStart === null
        ? true
        : k >= current.rangeStart && k <= current.rangeEnd;
    let cash = 0;
    let card = 0;
    for (const apt of appointments) {
      if (apt.status !== "completed" && apt.status !== "in_progress") continue;
      if (!inRange(apt.date)) continue;
      if (activeTeam !== "all" && apt.team_id !== activeTeam) continue;
      for (const p of apt.payments) {
        if (p.method === "cash") cash += p.amount;
        else if (p.method === "card") card += p.amount;
      }
      // Prepaid counts as cash — pre-pay обычно передаётся бригаде.
      if (apt.prepaid_amount > 0) cash += apt.prepaid_amount;
    }

    // Salary по активной команде или сумма по всем.
    const relevantTeams =
      activeTeam === "all" ? teams.filter((t) => t.active) : teams.filter((t) => t.id === activeTeam);
    let salary = 0;
    for (const t of relevantTeams) {
      const inc = curLines.inc
        .filter((l) => l.teamId === t.id)
        .reduce((s, l) => s + l.amount, 0);
      const exp = curLines.exp
        .filter((l) => l.teamId === t.id)
        .reduce((s, l) => s + l.amount, 0);
      const net = inc - exp;
      const pct = t.payout_percentage ?? 30;
      salary += Math.max(0, Math.round((net * pct) / 100));
    }

    const shouldBe = cash - totalExpense - salary;
    return { cash, card, expense: totalExpense, salary, shouldBe };
  }, [
    appointments,
    activeTeam,
    current,
    teams,
    curLines,
    totalExpense,
  ]);

  // ─── Debts ──────────────────────────────────────────────────────────
  const debts = useMemo<DebtLine[]>(() => {
    const inRange = (k: string) =>
      current.rangeStart === null
        ? true
        : k >= current.rangeStart && k <= current.rangeEnd;
    const out: DebtLine[] = [];
    for (const apt of appointments) {
      if (apt.status !== "completed") continue;
      if (!inRange(apt.date)) continue;
      if (activeTeam !== "all" && apt.team_id !== activeTeam) continue;
      const d = getDebtAmount(apt);
      if (d <= 0) continue;
      const clientName =
        (apt.client_id && clientsById.get(apt.client_id)?.full_name) ||
        apt.comment ||
        "Клиент";
      out.push({
        id: `debt-${apt.id}`,
        clientId: apt.client_id,
        clientName,
        dateKey: apt.date,
        total: apt.total_amount,
        paid: getPaidAmount(apt),
        debt: d,
        appointmentId: apt.id,
      });
    }
    return out.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [appointments, clientsById, activeTeam, current]);

  const debtsByClient = useMemo(() => {
    const map = new Map<string, { clientId: string | null; name: string; total: number; items: DebtLine[] }>();
    for (const d of debts) {
      const key = d.clientId ?? `noclient-${d.appointmentId}`;
      const entry = map.get(key) ?? {
        clientId: d.clientId,
        name: d.clientName,
        total: 0,
        items: [],
      };
      entry.total += d.debt;
      entry.items.push(d);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [debts]);

  const totalDebt = debts.reduce((s, d) => s + d.debt, 0);

  // ─── Payroll ────────────────────────────────────────────────────────
  const payroll = useMemo(() => {
    return teams
      .filter((t) => t.active)
      .map((team) => {
        const inc = curLines.inc
          .filter((l) => l.teamId === team.id)
          .reduce((s, l) => s + l.amount, 0);
        const exp = curLines.exp
          .filter((l) => l.teamId === team.id)
          .reduce((s, l) => s + l.amount, 0);
        const net = inc - exp;
        const pct = team.payout_percentage ?? 30;
        const payable = Math.max(0, Math.round((net * pct) / 100));
        return { team, income: inc, expense: exp, net, percentage: pct, payable };
      });
  }, [teams, curLines]);

  const totalPayroll = payroll.reduce((s, p) => s + p.payable, 0);

  // ─── Services income breakdown ──────────────────────────────────────
  const servicesBreakdown = useMemo(() => {
    // Distribute each appointment's paid amount pro-rata by the list
    // price of each service on it (so a 3-item apt where service A is
    // €100 and B is €50 attributes 2/3 to A). Fallback = equal split.
    const bucket = new Map<string, { name: string; count: number; revenue: number }>();
    for (const line of filteredIncome) {
      if (line.sourceType !== "appointment") continue;
      const sids = line.serviceIds;
      if (sids.length === 0) continue;
      const prices = sids.map((sid) => servicesById.get(sid)?.price ?? 0);
      const totalPrice = prices.reduce((s, p) => s + p, 0);
      for (let i = 0; i < sids.length; i++) {
        const sid = sids[i];
        const svc = servicesById.get(sid);
        if (!svc) continue;
        const share =
          totalPrice > 0 ? prices[i] / totalPrice : 1 / sids.length;
        const cur = bucket.get(sid) ?? { name: svc.name, count: 0, revenue: 0 };
        cur.count++;
        cur.revenue += line.amount * share;
        bucket.set(sid, cur);
      }
    }
    return Array.from(bucket.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredIncome, servicesById]);

  const expensesGrouped = useMemo(() => {
    const groups = new Map<string, ExpenseLine[]>();
    for (const e of filteredExpenses) {
      const key = e.category || "Прочее";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries()).sort(
      (a, b) => sum(b[1]) - sum(a[1])
    );
  }, [filteredExpenses]);

  const selectedPeriodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  const comparableToPrev = period !== "all";

  return (
    <>
      <PageHeader
        title="Финансы"
        rightContent={
          <button
            type="button"
            onClick={() => setShowCategories(true)}
            className="px-2 py-1.5 lg:px-3 text-xs lg:text-sm font-medium text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 rounded-lg"
          >
            ⚙ Категории
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-8 space-y-3 stagger-children">
          {/* Summary cards: 4 metrics at a glance with delta vs prev period */}
          <div className="grid grid-cols-4 gap-1.5">
            <SummaryCard
              label="Доход"
              amount={totalIncome}
              color="emerald"
              active={mode === "income"}
              onClick={() => setMode("income")}
              delta={comparableToPrev ? percentDelta(totalIncome, prevIncome) : null}
              deltaPositiveGood
            />
            <SummaryCard
              label="Расход"
              amount={totalExpense}
              color="rose"
              active={mode === "expenses"}
              onClick={() => setMode("expenses")}
              delta={comparableToPrev ? percentDelta(totalExpense, prevExpense) : null}
            />
            <SummaryCard
              label="Прибыль"
              amount={profit}
              signed
              color={profit >= 0 ? "indigo" : "rose"}
              active={mode === "summary"}
              onClick={() => setMode("summary")}
              delta={comparableToPrev ? percentDelta(profit, prevProfit) : null}
              deltaPositiveGood
            />
            <SummaryCard
              label="Долги"
              amount={totalDebt}
              color="amber"
              active={mode === "debts"}
              onClick={() => setMode("debts")}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden">
            {/* Period selector */}
            <div className="px-4 py-3 border-b border-gray-200 relative flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPeriodMenu((s) => !s)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-900 hover:opacity-80"
              >
                {selectedPeriodLabel}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setMode("payroll")}
                className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition ${
                  mode === "payroll"
                    ? "bg-violet-600 text-white"
                    : "bg-violet-50 text-violet-700 active:bg-violet-100"
                }`}
              >
                Зарплата {totalPayroll > 0 && `· ${formatEUR(totalPayroll)}`}
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full left-4 mt-1 bg-white rounded-lg shadow-lg py-1 z-10 min-w-[200px] border border-gray-200">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPeriod(p.key);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        period === p.key
                          ? "text-indigo-600 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {teamTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTeam(tab.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTeam === tab.id
                      ? "text-indigo-600 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {MODE_LABELS[mode]}
              </div>
            </div>

            {mode === "income" && (
              <IncomeTab
                entries={filteredIncome}
                total={totalIncome}
                teamById={teamById}
                services={servicesBreakdown}
              />
            )}

            {mode === "expenses" && (
              <ExpenseGroups
                groups={expensesGrouped}
                categories={categories}
                total={totalExpense}
                teamById={teamById}
              />
            )}

            {mode === "summary" && (
              <>
                <CombinedSummary
                  incomeCount={filteredIncome.length}
                  expenseCount={filteredExpenses.length}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                />
                <CashboxBlock
                  cash={cashbox.cash}
                  card={cashbox.card}
                  expense={cashbox.expense}
                  salary={cashbox.salary}
                  shouldBe={cashbox.shouldBe}
                />
              </>
            )}

            {mode === "debts" && (
              <DebtsTab
                groups={debtsByClient}
                total={totalDebt}
                onOpenClient={(clientId) => {
                  if (!clientId) return;
                  router.push(`/dashboard/clients?id=${clientId}`);
                }}
                clientsById={clientsById}
              />
            )}

            {mode === "payroll" && (
              <PayrollTab entries={payroll} total={totalPayroll} />
            )}
          </div>
        </div>
      </div>

      {showCategories && (
        <ExpenseCategoriesSheet
          categories={categories}
          onClose={() => setShowCategories(false)}
          onSave={(next) => {
            setCategories(next);
            setShowCategories(false);
          }}
        />
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function sum(arr: { amount: number }[]): number {
  return arr.reduce((s, e) => s + e.amount, 0);
}

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeRange(period: PeriodKey): {
  rangeStart: string | null;
  rangeEnd: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = toDateKey(today);
  if (period === "all") return { rangeStart: null, rangeEnd: end };
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { rangeStart: toDateKey(first), rangeEnd: end };
  }
  const days = period === "7d" ? 7 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  return { rangeStart: toDateKey(start), rangeEnd: end };
}

function computePreviousRange(
  period: PeriodKey,
  current: { rangeStart: string | null; rangeEnd: string }
): { rangeStart: string | null; rangeEnd: string } {
  if (period === "all" || !current.rangeStart) {
    return { rangeStart: null, rangeEnd: current.rangeEnd };
  }
  if (period === "month") {
    const [y, m] = current.rangeStart.split("-").map(Number);
    const prevMonthStart = new Date(y, m - 2, 1);
    const prevMonthEnd = new Date(y, m - 1, 0); // last day of prev month
    return {
      rangeStart: toDateKey(prevMonthStart),
      rangeEnd: toDateKey(prevMonthEnd),
    };
  }
  // Sliding 7d / 30d window — previous block of same length.
  const days = period === "7d" ? 7 : 30;
  const [sy, sm, sd] = current.rangeStart.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  start.setDate(start.getDate() - days);
  const end = new Date(sy, sm - 1, sd);
  end.setDate(end.getDate() - 1);
  return { rangeStart: toDateKey(start), rangeEnd: toDateKey(end) };
}

function datesInRange(
  rangeStart: string | null,
  rangeEnd: string
): string[] {
  if (!rangeStart) return [];
  const out: string[] = [];
  const [sy, sm, sd] = rangeStart.split("-").map(Number);
  const [ey, em, ed] = rangeEnd.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const stop = new Date(ey, em - 1, ed);
  while (cur <= stop) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function percentDelta(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : 100;
  return ((current - prev) / Math.abs(prev)) * 100;
}

// ─── Sub-components ────────────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  color,
  active,
  onClick,
  delta,
  signed,
  deltaPositiveGood,
}: {
  label: string;
  amount: number;
  color: "emerald" | "rose" | "indigo" | "amber";
  active: boolean;
  onClick: () => void;
  delta?: number | null;
  signed?: boolean;
  deltaPositiveGood?: boolean;
}) {
  const amountColor =
    color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
      ? "text-rose-600"
      : color === "amber"
      ? "text-amber-600"
      : "text-indigo-600";

  const body = signed ? formatEURSigned(amount) : formatEUR(amount);

  let deltaEl: React.ReactNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const positive = delta > 0;
    const goodDirection = deltaPositiveGood ? positive : !positive;
    const deltaColor =
      delta === 0
        ? "text-gray-400"
        : goodDirection
        ? "text-emerald-600"
        : "text-rose-500";
    deltaEl = (
      <div className={`text-[10px] font-semibold tabular-nums ${deltaColor}`}>
        {formatPercentDelta(delta)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-2 py-2 text-left transition active:scale-[0.98] ${
        active
          ? "bg-white border-indigo-500 ring-1 ring-indigo-500"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`text-[13px] font-bold tabular-nums mt-0.5 ${amountColor}`}>
        {body}
      </div>
      {deltaEl}
    </button>
  );
}

function IncomeTab({
  entries,
  total,
  teamById,
  services,
}: {
  entries: IncomeLine[];
  total: number;
  teamById: Map<string, string>;
  services: { name: string; count: number; revenue: number }[];
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет доходных записей
      </div>
    );
  }
  return (
    <>
      {services.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-emerald-50/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            По типам услуг
          </div>
          <div className="space-y-1">
            {services.slice(0, 6).map((s) => {
              const avg = s.count > 0 ? Math.round(s.revenue / s.count) : 0;
              const pct = total > 0 ? (s.revenue / total) * 100 : 0;
              return (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-gray-900 truncate">
                        {s.name}
                      </span>
                      <span className="text-[12px] font-semibold text-emerald-700 tabular-nums">
                        {formatEUR(s.revenue)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 tabular-nums">
                      {s.count} зак. · ср. {formatEUR(avg)} · {Math.round(pct)}%
                    </div>
                    <div className="h-1 bg-emerald-100 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {entry.description}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {formatDateLongRu(entry.dateKey)}
              {entry.teamId && teamById.get(entry.teamId)
                ? ` • ${teamById.get(entry.teamId)}`
                : ""}
              {entry.sourceType === "extra" ? " • вручную" : ""}
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-600 tabular-nums">
            +{formatEUR(entry.amount)}
          </div>
        </div>
      ))}
      <TotalRow label="Итого доход" value={total} color="emerald" />
    </>
  );
}

function ExpenseGroups({
  groups,
  categories,
  total,
  teamById,
}: {
  groups: [string, ExpenseLine[]][];
  categories: ExpenseCategory[];
  total: number;
  teamById: Map<string, string>;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет расходных записей
      </div>
    );
  }
  return (
    <>
      {groups.map(([catName, entries]) => {
        const cat = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase()
        );
        const catTotal = sum(entries);
        return (
          <div key={catName}>
            <div
              className="px-4 py-2 bg-gray-50 border-y border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: cat ? `${cat.color}12` : undefined }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.icon ?? "📋"}</span>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {catName}
                </span>
              </div>
              <span className="text-sm font-bold text-rose-600 tabular-nums">
                −{formatEUR(catTotal)}
              </span>
            </div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {entry.description}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {formatDateLongRu(entry.dateKey)}
                    {entry.teamId && teamById.get(entry.teamId)
                      ? ` • ${teamById.get(entry.teamId)}`
                      : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold text-rose-600 tabular-nums">
                  −{formatEUR(entry.amount)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <TotalRow label="Итого расход" value={-total} color="rose" />
    </>
  );
}

// STORY-003 cashbox reconciliation. Показывает из чего собрался
// итог кассы за период: сколько пришло налом/картой, сколько съели
// расходы, сколько уйдёт на ЗП (расчётная), сколько должно быть в
// руках. Пока без ручного ввода фактической суммы — это STORY-004.
function CashboxBlock({
  cash,
  card,
  expense,
  salary,
  shouldBe,
}: {
  cash: number;
  card: number;
  expense: number;
  salary: number;
  shouldBe: number;
}) {
  return (
    <div className="px-4 py-4 border-t border-gray-200 bg-white">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
        Сверка кассы
      </div>
      <div className="space-y-1.5">
        <KV label="Пришло наличкой" value={`+${formatEUR(cash)}`} tone="emerald" />
        <KV label="Пришло на карту" value={`+${formatEUR(card)}`} tone="sky" />
        <div className="h-px bg-gray-100 my-1" />
        <KV label="Расходы (из нала)" value={`−${formatEUR(expense)}`} tone="rose" />
        <KV
          label="ЗП бригаде (расчётная)"
          value={`−${formatEUR(salary)}`}
          tone="violet"
        />
        <div className="h-px bg-gray-200 my-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-900">
            В кассе должно быть
          </span>
          <span
            className={`text-[17px] font-bold tabular-nums ${
              shouldBe >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatEURSigned(shouldBe)}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Реальная сверка с вводом фактической суммы — в следующем обновлении.
      </p>
    </div>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "rose" | "violet";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "sky"
      ? "text-sky-600"
      : tone === "rose"
      ? "text-rose-600"
      : "text-violet-600";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span className={`text-[14px] font-semibold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

function CombinedSummary({
  incomeCount,
  expenseCount,
  totalIncome,
  totalExpense,
}: {
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
}) {
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0;

  return (
    <div>
      <div className="px-4 py-4 space-y-3 border-b border-gray-200">
        <Row label="Доход" value={`+${formatEUR(totalIncome)}`} color="emerald" />
        <Row label="Расход" value={`−${formatEUR(totalExpense)}`} color="rose" />
        <div className="h-px bg-gray-200" />
        <Row
          label="Прибыль"
          value={formatEURSigned(profit)}
          color={profit >= 0 ? "indigo" : "rose"}
          bold
        />
        <Row label="Маржа" value={`${margin}%`} color="gray" />
      </div>

      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Счёт записей
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
          <div className="text-gray-700">
            Доходных строк: <span className="font-semibold">{incomeCount}</span>
          </div>
          <div className="text-gray-700">
            Расходных строк: <span className="font-semibold">{expenseCount}</span>
          </div>
        </div>
      </div>

      {profit < 0 && (
        <div className="px-4 py-3 text-[12px] text-rose-600 bg-rose-50 border-b border-rose-100">
          ⚠ За выбранный период расходы превышают доходы.
        </div>
      )}

      {incomeCount === 0 && expenseCount === 0 && (
        <div className="px-4 py-6 text-center text-[12px] text-gray-400">
          Нет данных за выбранный период.
        </div>
      )}
    </div>
  );
}

// ─── Debts ────────────────────────────────────────────────────────────

function DebtsTab({
  groups,
  total,
  onOpenClient,
  clientsById,
}: {
  groups: { clientId: string | null; name: string; total: number; items: DebtLine[] }[];
  total: number;
  onOpenClient: (clientId: string | null) => void;
  clientsById: Map<string, Client>;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Долгов нет — все выплачено.
      </div>
    );
  }
  return (
    <>
      {groups.map((g) => {
        const client = g.clientId ? clientsById.get(g.clientId) : null;
        const phone = (client as Client | undefined)?.phone;
        const phoneDigits = phone?.replace(/\D/g, "") ?? "";
        return (
          <div key={g.clientId ?? g.name} className="border-b border-gray-100">
            <button
              type="button"
              onClick={() => onOpenClient(g.clientId)}
              className="w-full px-4 py-3 flex items-center gap-3 active:bg-gray-50 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900 truncate">
                  {g.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {g.items.length} зак. · последний {formatDateLongRu(g.items[0].dateKey)}
                </div>
              </div>
              <div className="text-[15px] font-bold text-rose-600 tabular-nums shrink-0">
                −{formatEUR(g.total)}
              </div>
            </button>
            {phoneDigits && (
              <div className="px-4 pb-3 flex gap-2">
                <a
                  href={`tel:${phoneDigits}`}
                  className="flex-1 h-9 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-emerald-100"
                >
                  Позвонить
                </a>
                <a
                  href={`sms:${phoneDigits}?body=${encodeURIComponent(
                    `Здравствуйте! Напоминаем про оплату €${g.total}. AirFix.`
                  )}`}
                  className="flex-1 h-9 rounded-lg bg-sky-50 text-sky-700 text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-sky-100"
                >
                  SMS напоминание
                </a>
              </div>
            )}
          </div>
        );
      })}
      <TotalRow label="Итого долги" value={-total} color="rose" />
    </>
  );
}

// ─── Payroll ──────────────────────────────────────────────────────────

function PayrollTab({
  entries,
  total,
}: {
  entries: {
    team: { id: string; name: string; color: string; payout_percentage: number };
    income: number;
    expense: number;
    net: number;
    percentage: number;
    payable: number;
  }[];
  total: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет активных бригад.
      </div>
    );
  }
  return (
    <>
      <div className="px-4 py-2 bg-violet-50/40 border-b border-gray-100 text-[11px] text-gray-600">
        Зарплата = (доход − расход бригады) × процент выплаты. Настраивается
        в профиле бригады.
      </div>
      {entries.map((p) => (
        <div key={p.team.id} className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: p.team.color }}
            />
            <div className="flex-1 text-[14px] font-semibold text-gray-900">
              {p.team.name}
            </div>
            <div className="text-[11px] text-gray-500">
              {p.percentage}% × {formatEUR(p.net)}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
            <Kv label="Доход" value={`+${formatEUR(p.income)}`} color="emerald" />
            <Kv label="Расход" value={`−${formatEUR(p.expense)}`} color="rose" />
            <Kv label="Чистый" value={formatEURSigned(p.net)} color="indigo" />
          </div>
          <div className="mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[12px] text-gray-600">К выплате</span>
            <span className="text-[16px] font-bold text-violet-700 tabular-nums">
              {formatEUR(p.payable)}
            </span>
          </div>
        </div>
      ))}
      <TotalRow label="Всего к выплате" value={total} color="indigo" />
    </>
  );
}

function Kv({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "rose" | "indigo";
}) {
  const cc =
    color === "emerald"
      ? "text-emerald-700"
      : color === "rose"
      ? "text-rose-700"
      : "text-indigo-700";
  return (
    <div className="bg-gray-50 rounded-md px-2 py-1">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[12px] font-semibold tabular-nums ${cc}`}>{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: "emerald" | "rose" | "indigo" | "gray";
  bold?: boolean;
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
      ? "text-rose-600"
      : color === "indigo"
      ? "text-indigo-600"
      : "text-gray-600";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span
        className={`tabular-nums ${colorClass} ${bold ? "text-[16px] font-bold" : "text-[14px] font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "rose" | "indigo";
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
      ? "text-rose-600"
      : "text-indigo-600";
  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}:</span>
        <span className={`text-base font-bold tabular-nums ${colorClass}`}>
          {formatEURSigned(value)}
        </span>
      </div>
    </div>
  );
}

// ─── Categories management sheet (unchanged) ───────────────────────────

function ExpenseCategoriesSheet({
  categories,
  onClose,
  onSave,
}: {
  categories: ExpenseCategory[];
  onClose: () => void;
  onSave: (next: ExpenseCategory[]) => void;
}) {
  const [draft, setDraft] = useState<ExpenseCategory[]>(categories);

  const update = (id: string, patch: Partial<ExpenseCategory>) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) =>
    setDraft((prev) => prev.filter((c) => c.id !== id));
  const add = () => setDraft((prev) => [...prev, createBlankExpenseCategory()]);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Категории расходов
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {draft.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
            >
              <input
                type="text"
                value={c.icon}
                onChange={(e) => update(c.id, { icon: e.target.value.slice(0, 2) })}
                className="w-10 text-center text-xl bg-white border border-gray-300 rounded"
                placeholder="📋"
              />
              <input
                type="color"
                value={c.color}
                onChange={(e) => update(c.id, { color: e.target.value })}
                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                placeholder="Название"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
              />
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="w-8 h-8 text-rose-500 hover:bg-rose-50 rounded"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full py-2 text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            + Новая категория
          </button>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
