// Pure aggregation over the FinanceTransaction ledger. No side-effects;
// the /finances page passes in a window of transactions + the active
// accounts + the appointment list and gets back ready numbers.

import type {
  FinanceTransaction,
  TransactionType,
} from "@babun/shared/local/finance/transaction";
import type { Account } from "@babun/shared/local/finance/account";
import type { Appointment } from "@babun/shared/local/appointments";

export interface PeriodTotals {
  income: number;   // Σ income + Σ refunds (refunds are signed negative)
  expense: number;  // Σ expense
  profit: number;   // income - expense
  expectedProfit: number; // planned-but-not-yet-paid appointments minus expense
  debt: number;     // completed-but-unpaid appointments
}

const isIncome = (t: FinanceTransaction) => t.type === "income";
const isRefund = (t: FinanceTransaction) => t.type === "refund";
const isExpense = (t: FinanceTransaction) => t.type === "expense";

export interface ComputePeriodArgs {
  transactions: FinanceTransaction[];
  appointments: Appointment[];
  brigadeFilter?: string[];
  /** Period bounds (inclusive YYYY-MM-DD). For expected/debt only. */
  fromDate: string;
  toDate: string;
}

export function computePeriodTotals(args: ComputePeriodArgs): PeriodTotals {
  const txInBrigades = args.brigadeFilter && args.brigadeFilter.length > 0
    ? args.transactions.filter((t) => t.team_id && args.brigadeFilter!.includes(t.team_id))
    : args.transactions;

  let income = 0;
  let expense = 0;
  for (const t of txInBrigades) {
    if (isIncome(t)) income += t.amount;
    else if (isRefund(t)) income += t.amount; // already negative for refunds
    else if (isExpense(t)) expense += t.amount;
    // transfers net to zero across pair — ignored in P&L
  }
  const profit = income - expense;

  // Expected = sum total_amount of non-cancelled, non-paid appointments
  // in the period for the selected brigades, minus the expense that
  // already happened. Conservative: assumes no extra expense will land.
  const inRange = (date: string) => date >= args.fromDate && date <= args.toDate;
  const inBrigades = (teamId: string | null) =>
    !args.brigadeFilter || args.brigadeFilter.length === 0
      ? true
      : !!teamId && args.brigadeFilter.includes(teamId);

  let pendingPlan = 0;
  let debt = 0;
  for (const a of args.appointments) {
    if (a.status === "cancelled") continue;
    if (!inRange(a.date)) continue;
    if (!inBrigades(a.team_id ?? null)) continue;

    if (a.payment_status !== "paid") {
      pendingPlan += a.total_amount ?? 0;
      if (a.status === "completed") {
        // outstanding work the client owes for
        debt += Math.max(0, (a.total_amount ?? 0) - (a.paid_amount ?? 0));
      }
    }
  }
  const expectedProfit = income + pendingPlan - expense;

  return { income, expense, profit, expectedProfit, debt };
}

// ─── Account balance ────────────────────────────────────────────────
// Balance = opening_balance + Σ signed amount of every tx tied to this
// account. Transfer pairs net to zero across the tenant, but per-account
// each leg moves balance (one negative, one positive).
export function computeAccountBalance(
  account: Account,
  transactions: FinanceTransaction[],
): number {
  let balance = account.opening_balance;
  for (const t of transactions) {
    if (t.account_id !== account.id) continue;
    if (t.type === "income") balance += t.amount;
    else if (t.type === "refund") balance += t.amount; // already negative
    else if (t.type === "expense") balance -= t.amount;
    else if (t.type === "transfer") balance += t.amount; // sign carried on row
  }
  return balance;
}

// ─── Brigade / label breakdown ──────────────────────────────────────
export interface BrigadeRow {
  brigade_id: string;
  income: number;
  expense: number;
  profit: number;
}

export function breakdownByBrigade(
  transactions: FinanceTransaction[],
  brigadeIds: string[],
): BrigadeRow[] {
  const map = new Map<string, BrigadeRow>();
  for (const id of brigadeIds) {
    map.set(id, { brigade_id: id, income: 0, expense: 0, profit: 0 });
  }
  for (const t of transactions) {
    if (!t.team_id) continue;
    const row = map.get(t.team_id);
    if (!row) continue;
    if (t.type === "income" || t.type === "refund") row.income += t.amount;
    else if (t.type === "expense") row.expense += t.amount;
  }
  for (const row of map.values()) row.profit = row.income - row.expense;
  return Array.from(map.values());
}

// ─── Day grouping for the feed ──────────────────────────────────────
export interface DayGroup {
  date: string; // YYYY-MM-DD
  transactions: FinanceTransaction[];
  net: number;  // income + refund - expense (transfers ignored)
}

export function groupByDay(transactions: FinanceTransaction[]): DayGroup[] {
  const byDate = new Map<string, FinanceTransaction[]>();
  for (const t of transactions) {
    const list = byDate.get(t.occurred_on) ?? [];
    list.push(t);
    byDate.set(t.occurred_on, list);
  }
  const groups: DayGroup[] = [];
  for (const [date, list] of byDate.entries()) {
    let net = 0;
    for (const t of list) {
      if (t.type === "income" || t.type === "refund") net += t.amount;
      else if (t.type === "expense") net -= t.amount;
    }
    groups.push({ date, transactions: list, net });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : -1));
  return groups;
}

// ─── Type guards used by the UI ─────────────────────────────────────
export function filterTypes(
  transactions: FinanceTransaction[],
  types: TransactionType[],
): FinanceTransaction[] {
  return transactions.filter((t) => types.includes(t.type));
}
