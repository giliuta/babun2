// Day-level manual income/expense adjustments. Every team, for every
// day, can store a list of extra line items (e.g. "Чаевые", "Заправка
// машины") on top of what the appointments already contribute. Used by
// the DayFinanceModal that opens when the user taps a day footer.

const STORAGE_KEY = "babun-day-extras";

export type DayExtraKind = "income" | "expense";

/** STORY-003: quick-pick категория расхода. Совпадает с ключами
 *  EXPENSE_CATEGORIES в lib/finance/expense-categories.ts. */
export type ExpenseCategoryKey = "fuel" | "food" | "supplies" | "other";

export interface DayExtra {
  id: string;
  name: string;
  amount: number; // positive; sign is implied by kind
  kind: DayExtraKind;
  /** Категория — только для расходов. Income-extras её не используют. */
  category?: ExpenseCategoryKey;
}

export type DayExtrasMap = Record<string, DayExtra[]>; // key = "teamId:date"

export function dayExtrasKey(teamId: string, dateKey: string): string {
  return `${teamId}:${dateKey}`;
}

export function loadDayExtras(): DayExtrasMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DayExtrasMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveDayExtras(map: DayExtrasMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getDayExtras(
  map: DayExtrasMap,
  teamId: string | null,
  dateKey: string
): DayExtra[] {
  if (!teamId) return [];
  return map[dayExtrasKey(teamId, dateKey)] ?? [];
}

export function setDayExtrasFor(
  map: DayExtrasMap,
  teamId: string,
  dateKey: string,
  extras: DayExtra[]
): DayExtrasMap {
  const key = dayExtrasKey(teamId, dateKey);
  const next = { ...map };
  if (extras.length === 0) {
    delete next[key];
  } else {
    next[key] = extras;
  }
  return next;
}

export function sumExtras(extras: DayExtra[]): {
  income: number;
  expense: number;
} {
  let income = 0;
  let expense = 0;
  for (const e of extras) {
    if (e.kind === "income") income += e.amount;
    else expense += e.amount;
  }
  return { income, expense };
}
