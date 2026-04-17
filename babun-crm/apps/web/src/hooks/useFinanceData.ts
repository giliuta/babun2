"use client";

import { useMemo } from "react";
import { getPaidAmount, getDebtAmount, type Appointment } from "@/lib/appointments";
import { getServiceMaterialCost, type Service } from "@/lib/services";
import type { Client } from "@/lib/clients";
import type { Team } from "@/lib/masters";
import type { DayExtra } from "@/lib/day-extras";
import type { ExpenseCategory } from "@/lib/expense-categories";

// ─── Public types ──────────────────────────────────────────────────────────

export type PeriodKey = "7d" | "30d" | "month" | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "За последние 7 дней" },
  { key: "30d", label: "За последние 30 дней" },
  { key: "month", label: "За текущий месяц" },
  { key: "all", label: "За всё время" },
];

export interface IncomeLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  sourceType: "appointment" | "extra";
  serviceIds: string[];
}

export interface ExpenseLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  category: string;
  sourceType: "material" | "custom" | "extra";
}

export interface DebtLine {
  id: string;
  clientId: string | null;
  clientName: string;
  dateKey: string;
  total: number;
  paid: number;
  debt: number;
  appointmentId: string;
}

interface DateRange {
  rangeStart: string | null;
  rangeEnd: string;
}

// ─── Pure helpers (exported for use in FinanceTabs) ───────────────────────

export function sum(arr: { amount: number }[]): number {
  return arr.reduce((s, e) => s + e.amount, 0);
}

export function percentDelta(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : 100;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function computeRange(period: PeriodKey): DateRange {
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

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computePreviousRange(period: PeriodKey, current: DateRange): DateRange {
  if (period === "all" || !current.rangeStart) {
    return { rangeStart: null, rangeEnd: current.rangeEnd };
  }
  if (period === "month") {
    const [y, m] = current.rangeStart.split("-").map(Number);
    const prevMonthStart = new Date(y, m - 2, 1);
    const prevMonthEnd = new Date(y, m - 1, 0);
    return { rangeStart: toDateKey(prevMonthStart), rangeEnd: toDateKey(prevMonthEnd) };
  }
  const days = period === "7d" ? 7 : 30;
  const [sy, sm, sd] = current.rangeStart.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  start.setDate(start.getDate() - days);
  const end = new Date(sy, sm - 1, sd);
  end.setDate(end.getDate() - 1);
  return { rangeStart: toDateKey(start), rangeEnd: toDateKey(end) };
}

function datesInRange(rangeStart: string | null, rangeEnd: string): string[] {
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

// ─── Hook ──────────────────────────────────────────────────────────────────

interface UseFinanceDataParams {
  appointments: Appointment[];
  teams: Team[];
  services: Service[];
  clients: Client[];
  getExtrasFor: (teamId: string, dateKey: string) => DayExtra[];
  categories: ExpenseCategory[];
  period: PeriodKey;
  activeTeam: string;
}

export interface UseFinanceDataResult {
  teamTabs: { id: string; name: string }[];
  teamById: Map<string, string>;
  clientsById: Map<string, Client>;
  servicesById: Map<string, Service>;
  current: DateRange;
  filteredIncome: IncomeLine[];
  filteredExpenses: ExpenseLine[];
  prevFilteredIncome: IncomeLine[];
  prevFilteredExpenses: ExpenseLine[];
  totalIncome: number;
  totalExpense: number;
  profit: number;
  prevIncome: number;
  prevExpense: number;
  prevProfit: number;
  cashbox: { cash: number; card: number; expense: number; salary: number; shouldBe: number };
  debts: DebtLine[];
  debtsByClient: { clientId: string | null; name: string; total: number; items: DebtLine[] }[];
  totalDebt: number;
  payroll: { team: Team; income: number; expense: number; net: number; percentage: number; payable: number }[];
  totalPayroll: number;
  servicesBreakdown: { name: string; count: number; revenue: number }[];
  expensesGrouped: [string, ExpenseLine[]][];
  comparableToPrev: boolean;
  selectedPeriodLabel: string;
}

export function useFinanceData({
  appointments,
  teams,
  services,
  clients,
  getExtrasFor,
  period,
  activeTeam,
}: UseFinanceDataParams): UseFinanceDataResult {

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

  const current = useMemo(() => computeRange(period), [period]);
  const previous = useMemo(() => computePreviousRange(period, current), [period, current]);

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
            description: serviceSummary ? `${serviceSummary} — ${clientName}` : clientName,
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

  const curLines = useMemo(() => buildLines(current.rangeStart, current.rangeEnd), [buildLines, current]);
  const prevLines = useMemo(() => buildLines(previous.rangeStart, previous.rangeEnd), [buildLines, previous]);

  // Filter by team — inline to avoid stale closure; activeTeam is a proper dep.
  const filteredIncome = useMemo(
    () => activeTeam === "all" ? curLines.inc : curLines.inc.filter((r) => r.teamId === activeTeam),
    [curLines.inc, activeTeam]
  );
  const filteredExpenses = useMemo(
    () => activeTeam === "all" ? curLines.exp : curLines.exp.filter((r) => r.teamId === activeTeam),
    [curLines.exp, activeTeam]
  );
  const prevFilteredIncome = useMemo(
    () => activeTeam === "all" ? prevLines.inc : prevLines.inc.filter((r) => r.teamId === activeTeam),
    [prevLines.inc, activeTeam]
  );
  const prevFilteredExpenses = useMemo(
    () => activeTeam === "all" ? prevLines.exp : prevLines.exp.filter((r) => r.teamId === activeTeam),
    [prevLines.exp, activeTeam]
  );

  const totalIncome = sum(filteredIncome);
  const totalExpense = sum(filteredExpenses);
  const profit = totalIncome - totalExpense;
  const prevIncome = sum(prevFilteredIncome);
  const prevExpense = sum(prevFilteredExpenses);
  const prevProfit = prevIncome - prevExpense;

  const cashbox = useMemo(() => {
    const inRange = (k: string) =>
      current.rangeStart === null ? true : k >= current.rangeStart && k <= current.rangeEnd;
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
      if (apt.prepaid_amount > 0) cash += apt.prepaid_amount;
    }

    const relevantTeams =
      activeTeam === "all" ? teams.filter((t) => t.active) : teams.filter((t) => t.id === activeTeam);
    let salary = 0;
    for (const t of relevantTeams) {
      const inc = curLines.inc.filter((l) => l.teamId === t.id).reduce((s, l) => s + l.amount, 0);
      const exp = curLines.exp.filter((l) => l.teamId === t.id).reduce((s, l) => s + l.amount, 0);
      const net = inc - exp;
      const pct = t.payout_percentage ?? 30;
      salary += Math.max(0, Math.round((net * pct) / 100));
    }

    const shouldBe = cash - totalExpense - salary;
    return { cash, card, expense: totalExpense, salary, shouldBe };
  }, [appointments, activeTeam, current, teams, curLines, totalExpense]);

  const debts = useMemo<DebtLine[]>(() => {
    const inRange = (k: string) =>
      current.rangeStart === null ? true : k >= current.rangeStart && k <= current.rangeEnd;
    const out: DebtLine[] = [];
    for (const apt of appointments) {
      if (apt.status !== "completed") continue;
      if (!inRange(apt.date)) continue;
      if (activeTeam !== "all" && apt.team_id !== activeTeam) continue;
      const d = getDebtAmount(apt);
      if (d <= 0) continue;
      const clientName =
        (apt.client_id && clientsById.get(apt.client_id)?.full_name) || apt.comment || "Клиент";
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
      const entry = map.get(key) ?? { clientId: d.clientId, name: d.clientName, total: 0, items: [] };
      entry.total += d.debt;
      entry.items.push(d);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [debts]);

  const totalDebt = debts.reduce((s, d) => s + d.debt, 0);

  const payroll = useMemo(() => {
    return teams
      .filter((t) => t.active)
      .map((team) => {
        const inc = curLines.inc.filter((l) => l.teamId === team.id).reduce((s, l) => s + l.amount, 0);
        const exp = curLines.exp.filter((l) => l.teamId === team.id).reduce((s, l) => s + l.amount, 0);
        const net = inc - exp;
        const pct = team.payout_percentage ?? 30;
        const payable = Math.max(0, Math.round((net * pct) / 100));
        return { team, income: inc, expense: exp, net, percentage: pct, payable };
      });
  }, [teams, curLines]);

  const totalPayroll = payroll.reduce((s, p) => s + p.payable, 0);

  const servicesBreakdown = useMemo(() => {
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
        const share = totalPrice > 0 ? prices[i] / totalPrice : 1 / sids.length;
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
    return Array.from(groups.entries()).sort((a, b) => sum(b[1]) - sum(a[1]));
  }, [filteredExpenses]);

  return {
    teamTabs,
    teamById,
    clientsById,
    servicesById,
    current,
    filteredIncome,
    filteredExpenses,
    prevFilteredIncome,
    prevFilteredExpenses,
    totalIncome,
    totalExpense,
    profit,
    prevIncome,
    prevExpense,
    prevProfit,
    cashbox,
    debts,
    debtsByClient,
    totalDebt,
    payroll,
    totalPayroll,
    servicesBreakdown,
    expensesGrouped,
    comparableToPrev: period !== "all",
    selectedPeriodLabel: PERIODS.find((p) => p.key === period)?.label ?? "",
  };
}
