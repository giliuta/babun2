// Per-day financial summary — the numbers shown in the calendar's
// pinned day footer, the month-view day cells, and the day-finance
// detail popup. One source of truth so all three consumers always
// agree (the footer total can never drift from the popup breakdown).
//
// The income/expense/profit math intentionally mirrors the legacy
// DayFinanceModal so existing days keep the same totals.

import type { Appointment } from "../appointments";
import { getPaidAmount } from "../appointments";
import type { Service } from "../services";
import { getServiceMaterialCost } from "../services";
import type { DayExtra } from "../day-extras";
import { sumExtras } from "../day-extras";

// ─── Which footer rows a calendar shows ─────────────────────────────
// Toggled per brigade (Team.day_finance_rows) and on the personal
// calendar (CalendarSettings.dayFinanceRows). Undefined = all on.
export interface DayFinanceRowsConfig {
  /** Планируемый доход — потенциал по всем не-отменённым записям. */
  planned: boolean;
  /** Заработано — фактически оплачено + ручной доход. */
  earned: boolean;
  /** Потрачено — материалы + расходы по записям + ручные расходы. */
  spent: boolean;
  /** Прибыль — Заработано − Потрачено. */
  profit: boolean;
}

export const DEFAULT_DAY_FINANCE_ROWS: DayFinanceRowsConfig = {
  planned: true,
  earned: true,
  spent: true,
  profit: true,
};

/** Resolve a (possibly partial / undefined) stored config to a full one. */
export function resolveDayFinanceRows(
  cfg: Partial<DayFinanceRowsConfig> | undefined | null,
): DayFinanceRowsConfig {
  if (!cfg) return DEFAULT_DAY_FINANCE_ROWS;
  return {
    planned: cfg.planned ?? DEFAULT_DAY_FINANCE_ROWS.planned,
    earned: cfg.earned ?? DEFAULT_DAY_FINANCE_ROWS.earned,
    spent: cfg.spent ?? DEFAULT_DAY_FINANCE_ROWS.spent,
    profit: cfg.profit ?? DEFAULT_DAY_FINANCE_ROWS.profit,
  };
}

export function anyRowEnabled(cfg: DayFinanceRowsConfig): boolean {
  return cfg.planned || cfg.earned || cfg.spent || cfg.profit;
}

// ─── Payment-method breakdown (for the detail popup) ────────────────
export interface DayPaymentBreakdown {
  cash: number;
  card: number;
  transfer: number;
  /** Перевод/инвойс/аванс без явного метода и пр. */
  other: number;
}

export interface DayFinanceTotals {
  /** Сколько можно заработать — сумма по не-отменённым записям. */
  planned: number;
  /** Фактически заработано (оплачено) + ручной доход. */
  earned: number;
  /** Потрачено за день. */
  spent: number;
  /** Прибыль = earned − spent. */
  profit: number;
  /** Разбивка фактических платежей по способу оплаты. */
  byMethod: DayPaymentBreakdown;
  /** true если есть хоть какая-то ненулевая цифра — чтобы решить,
   *  рисовать ли строку вообще (пустые дни остаются чистыми). */
  hasAny: boolean;
}

const isClosable = (a: Appointment) =>
  a.status === "completed" || a.status === "in_progress";

/**
 * Compute the day's finance totals.
 *
 * @param appointments  ВСЕ записи дня (фильтрация по дате/команде —
 *                       на стороне вызывающего).
 * @param services      справочник услуг (для материалов).
 * @param extras        ручные доход/расход за этот день.
 */
export function computeDayFinance(
  appointments: Appointment[],
  services: Service[],
  extras: DayExtra[],
): DayFinanceTotals {
  const serviceById = new Map(services.map((s) => [s.id, s] as const));

  const earnedFromAppts = appointments
    .filter(isClosable)
    .reduce((sum, a) => sum + getPaidAmount(a), 0);

  const materialCost = appointments.filter(isClosable).reduce((sum, a) => {
    const cost = a.service_ids.reduce((c, sid) => {
      const s = serviceById.get(sid);
      return c + (s ? getServiceMaterialCost(s) : 0);
    }, 0);
    return sum + cost;
  }, 0);

  // Mirror DayFinanceModal: manual expenses summed across ALL records.
  const manualExpenses = appointments.reduce(
    (sum, a) => sum + a.expenses.reduce((s, e) => s + e.amount, 0),
    0,
  );

  const planned = appointments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + a.total_amount, 0);

  const extrasSum = sumExtras(extras);

  const earned = earnedFromAppts + extrasSum.income;
  const spent = materialCost + manualExpenses + extrasSum.expense;
  const profit = earned - spent;

  const byMethod: DayPaymentBreakdown = {
    cash: 0,
    card: 0,
    transfer: 0,
    other: 0,
  };
  for (const a of appointments) {
    if (!isClosable(a)) continue;
    for (const p of a.payments) {
      if (p.method === "cash") byMethod.cash += p.amount;
      else if (p.method === "card") byMethod.card += p.amount;
      else if (p.method === "transfer") byMethod.transfer += p.amount;
      else byMethod.other += p.amount;
    }
    // Авансы без явного метода падают в «прочее».
    if (a.prepaid_amount > 0) byMethod.other += a.prepaid_amount;
  }

  return {
    planned,
    earned,
    spent,
    profit,
    byMethod,
    hasAny: planned !== 0 || earned !== 0 || spent !== 0,
  };
}

// ─── Day mode (drives the finance modal layout) ─────────────────────
// By date, not by data: past day shows the closed-day P&L, today shows
// progress, future shows the plan. Both keys must be YYYY-MM-DD so the
// lexicographic compare matches chronological order.
export type DayMode = "future" | "today" | "past";

export function getDayMode(dateKey: string, todayKey: string): DayMode {
  if (dateKey > todayKey) return "future";
  if (dateKey < todayKey) return "past";
  return "today";
}
