"use client";

import { useEffect, useMemo, useState } from "react";
import { getDebtAmount, getPaidAmount, type Appointment } from "@babun/shared/local/appointments";
import { type Service } from "@babun/shared/local/services";
import type { Client } from "@babun/shared/local/clients";
import type { Team } from "@babun/shared/local/masters";
import type { DayExtra } from "@babun/shared/local/day-extras";
import type { ExpenseCategory } from "@babun/shared/local/expense-categories";
import {
  computeFinancials,
  type FinanceLine,
  type FinanceRange,
} from "@babun/shared/local/finance/compute";
import { loadPayments, type FinancePayment } from "@babun/shared/local/payments";
import { loadExpenses, type Expense } from "@babun/shared/local/expenses";

// ─── Public types ──────────────────────────────────────────────────────────

// P1 #31 (CRM Core brief) — finance reports were stuck on a single
// "last 30 days" lens. Added natural presets the dispatcher reads at
// a glance: сегодня (для конца смены), эта неделя (плановый чекап),
// текущий месяц, год, и две старые «X дней назад» опции для
// сравнений периодом-к-периоду. Custom-range picker is a separate
// follow-up (needs a date-range UI; intentionally not bundled here).
export type PeriodKey =
  | "today"
  | "week"
  | "month"
  | "year"
  | "7d"
  | "30d"
  | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Эта неделя" },
  { key: "month", label: "Этот месяц" },
  { key: "year", label: "Этот год" },
  { key: "7d", label: "Последние 7 дней" },
  { key: "30d", label: "Последние 30 дней" },
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
  /** P1 #28 (CRM Core brief) — appointment id for appointment-sourced
   *  lines, so callers can resolve the client without re-scanning the
   *  whole appointments array. Undefined for `extra` (manual) lines. */
  refId?: string;
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

/**
 * Percent-delta between two values. When prev is zero the ratio is
 * mathematically undefined — previous versions returned 100, which
 * made every first-in-period number look like a dishonest "+100 %"
 * win. Now:
 *   prev=0, current=0  → 0 (no change)
 *   prev=0, current>0  → +Infinity (render as "нов.")
 *   prev>0             → usual (current − prev) / |prev| × 100
 */
export function percentDelta(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function computeRange(period: PeriodKey): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = toDateKey(today);
  if (period === "all") return { rangeStart: null, rangeEnd: end };
  if (period === "today") return { rangeStart: end, rangeEnd: end };
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { rangeStart: toDateKey(first), rangeEnd: end };
  }
  if (period === "year") {
    const first = new Date(today.getFullYear(), 0, 1);
    return { rangeStart: toDateKey(first), rangeEnd: end };
  }
  if (period === "week") {
    // ISO Monday-start week. JS Sunday=0, Monday=1, …
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return { rangeStart: toDateKey(monday), rangeEnd: end };
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
  if (period === "today") {
    const [y, m, d] = current.rangeStart.split("-").map(Number);
    const prev = new Date(y, m - 1, d - 1);
    return { rangeStart: toDateKey(prev), rangeEnd: toDateKey(prev) };
  }
  if (period === "month") {
    const [y, m] = current.rangeStart.split("-").map(Number);
    const prevMonthStart = new Date(y, m - 2, 1);
    const prevMonthEnd = new Date(y, m - 1, 0);
    return { rangeStart: toDateKey(prevMonthStart), rangeEnd: toDateKey(prevMonthEnd) };
  }
  if (period === "year") {
    const [y] = current.rangeStart.split("-").map(Number);
    const prevYearStart = new Date(y - 1, 0, 1);
    const prevYearEnd = new Date(y - 1, 11, 31);
    return { rangeStart: toDateKey(prevYearStart), rangeEnd: toDateKey(prevYearEnd) };
  }
  if (period === "week") {
    const [sy, sm, sd] = current.rangeStart.split("-").map(Number);
    const prevStart = new Date(sy, sm - 1, sd - 7);
    const prevEnd = new Date(sy, sm - 1, sd - 1);
    return { rangeStart: toDateKey(prevStart), rangeEnd: toDateKey(prevEnd) };
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

function toIncomeLine(line: FinanceLine, appointments: Appointment[]): IncomeLine {
  const isAppointmentLike =
    line.source === "apt-payment" || line.source === "standalone-payment";
  let serviceIds: string[] = [];
  if (line.source === "apt-payment") {
    const apt = appointments.find((a) => a.id === line.refId);
    serviceIds = apt?.service_ids ?? [];
  }
  return {
    id: line.id,
    dateKey: line.dateKey,
    description: line.description,
    amount: line.amount,
    teamId: line.teamId,
    sourceType: isAppointmentLike ? "appointment" : "extra",
    serviceIds,
    // P1 #28 — carry the source appointment id through so the
    // clientsBreakdown can join back without scanning twice.
    refId: line.source === "apt-payment" ? line.refId : undefined,
  };
}

function toExpenseLine(line: FinanceLine): ExpenseLine {
  let sourceType: ExpenseLine["sourceType"];
  if (line.source === "apt-material") sourceType = "material";
  else if (line.source === "extra-expense") sourceType = "extra";
  else sourceType = "custom";
  return {
    id: line.id,
    dateKey: line.dateKey,
    description: line.description,
    amount: line.amount,
    teamId: line.teamId,
    category: line.category ?? "Прочее",
    sourceType,
  };
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
  payroll: {
    team: Team;
    income: number;
    expense: number;
    net: number;
    percentage: number;
    payable: number;
    /** P1 #30 — per-master shares of the team payable. Visit-count
     *  weighted; falls back to equal split when nobody has visits
     *  in the period yet. */
    masters: { masterId: string; visits: number; share: number }[];
  }[];
  totalPayroll: number;
  servicesBreakdown: { name: string; count: number; revenue: number }[];
  /** P1 #28 (CRM Core brief) — top-revenue clients in the active
   *  period, used by FinancePieChart on /finances. */
  clientsBreakdown: { id: string; name: string; revenue: number }[];
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

  // Standalone FinancePayment / Expense tables (new Phase-2 finance stores).
  // Loaded client-side so /dashboard/finances sees the exact same
  // superset of money events across its tabs. Refresh on the same
  // events that the rest of the app listens to.
  const [standalonePayments, setStandalonePayments] = useState<FinancePayment[]>([]);
  const [standaloneExpenses, setStandaloneExpenses] = useState<Expense[]>([]);
  useEffect(() => {
    const refresh = () => {
      setStandalonePayments(loadPayments());
      setStandaloneExpenses(loadExpenses());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const toFinanceRange = (r: { rangeStart: string | null; rangeEnd: string }): FinanceRange => ({
    from: r.rangeStart,
    to: r.rangeEnd,
  });

  // Build income/expense lines via the unified compute function and map
  // back to the legacy IncomeLine/ExpenseLine shape that FinanceTabs
  // still expects. The whole app now shares one arithmetic source.
  const buildLines = useMemo(() => {
    return (rangeStart: string | null, rangeEnd: string) => {
      const res = computeFinancials({
        appointments,
        services,
        teams,
        dayExtrasOf: getExtrasFor,
        standalonePayments,
        standaloneExpenses,
        clientsById,
        range: { from: rangeStart, to: rangeEnd },
        // teamFilter is intentionally "all" here — legacy callers filter
        // downstream by inspecting teamId on each line.
        teamFilter: "all",
      });
      const inc: IncomeLine[] = res.incomeLines.map((l) =>
        toIncomeLine(l, appointments)
      );
      const exp: ExpenseLine[] = res.expenseLines.map(toExpenseLine);
      return { inc, exp };
    };
  }, [appointments, clientsById, services, teams, getExtrasFor, standalonePayments, standaloneExpenses]);

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

        // P1 #30 (CRM Core brief) — per-master breakdown. Operator
        // asks «кому конкретно я должен сколько?». We split the
        // team's payable proportionally to each master's visit count
        // in the active period:
        //   share_master = (visits_by_master / total_visits) × payable
        // Falls back to an equal split when nobody has visits yet
        // (rare — fresh team in a fresh period). Equal split keeps the
        // total summing to `payable` exactly modulo rounding.
        const teamAppts = appointments.filter(
          (a) =>
            a.team_id === team.id &&
            a.status === "completed" &&
            a.date >= (current.rangeStart ?? "0000-01-01") &&
            a.date <= current.rangeEnd,
        );
        const visitsByMaster = new Map<string, number>();
        for (const a of teamAppts) {
          if (!a.master_id) continue;
          visitsByMaster.set(a.master_id, (visitsByMaster.get(a.master_id) ?? 0) + 1);
        }
        const totalVisits = Array.from(visitsByMaster.values()).reduce((s, v) => s + v, 0);
        // Members of the team — lead + helpers + brigade members union.
        const memberIds = new Set<string>();
        if (team.lead_id) memberIds.add(team.lead_id);
        for (const id of team.helper_ids ?? []) memberIds.add(id);
        if (Array.isArray(team.members)) {
          for (const m of team.members) memberIds.add(m.master_id);
        }

        const masters: { masterId: string; visits: number; share: number }[] = [];
        if (totalVisits > 0) {
          for (const [masterId, visits] of visitsByMaster) {
            masters.push({
              masterId,
              visits,
              share: Math.round((payable * visits) / totalVisits),
            });
          }
        } else if (memberIds.size > 0) {
          const equalShare = Math.round(payable / memberIds.size);
          for (const id of memberIds) {
            masters.push({ masterId: id, visits: 0, share: equalShare });
          }
        }
        masters.sort((a, b) => b.share - a.share);

        return { team, income: inc, expense: exp, net, percentage: pct, payable, masters };
      });
  }, [teams, curLines, appointments, current]);

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

  // P1 #28 — per-client revenue aggregation in the active period.
  // Income lines carry the client id via the appointment they
  // resolve from; standalone payments + manual extras (no client)
  // collapse into a single «Без клиента» bucket.
  const clientsBreakdown = useMemo(() => {
    const bucket = new Map<string, { id: string; name: string; revenue: number }>();
    for (const line of filteredIncome) {
      let clientId: string | null = null;
      let clientName = "Без клиента";
      if (line.sourceType === "appointment") {
        const apt = appointments.find((a) => a.id === line.refId);
        clientId = apt?.client_id ?? null;
        if (clientId) {
          const c = clients.find((x) => x.id === clientId);
          clientName = c?.full_name ?? "—";
        }
      }
      const key = clientId ?? "__none__";
      const cur = bucket.get(key) ?? { id: key, name: clientName, revenue: 0 };
      cur.revenue += line.amount;
      bucket.set(key, cur);
    }
    return Array.from(bucket.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredIncome, appointments, clients]);

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
    clientsBreakdown,
    expensesGrouped,
    comparableToPrev: period !== "all",
    selectedPeriodLabel: PERIODS.find((p) => p.key === period)?.label ?? "",
  };
}
