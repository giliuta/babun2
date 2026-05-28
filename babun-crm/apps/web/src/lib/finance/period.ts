// Period switcher for /finances: Сегодня / Вчера / Неделя / Месяц / Год
// / Произвольно. Returns a YYYY-MM-DD range compared against
// `finance_transactions.occurred_on`.

export type PeriodKind = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export interface PeriodRange {
  from: string; // inclusive YYYY-MM-DD
  to: string;   // inclusive YYYY-MM-DD
}

export interface PeriodSelection {
  kind: PeriodKind;
  /** Required when kind === "custom". */
  custom?: PeriodRange;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getPeriodRange(sel: PeriodSelection, now: Date = new Date()): PeriodRange {
  if (sel.kind === "custom" && sel.custom) return sel.custom;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (sel.kind) {
    case "today":
      return { from: toYmd(today), to: toYmd(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: toYmd(y), to: toYmd(y) };
    }
    case "week": {
      // Monday-based ISO week so it matches the calendar grid.
      const dow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
      const monday = addDays(today, -dow);
      const sunday = addDays(monday, 6);
      return { from: toYmd(monday), to: toYmd(sunday) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "custom":
      // No custom range supplied — fall back to today.
      return { from: toYmd(today), to: toYmd(today) };
  }
}

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  week: "Неделя",
  month: "Месяц",
  year: "Год",
  custom: "Произвольно",
};

export const PERIOD_ORDER: PeriodKind[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "year",
  "custom",
];
