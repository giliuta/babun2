// Period switcher for /finances: Сегодня / Вчера / Неделя / Месяц / Год
// / Произвольно. Returns a YYYY-MM-DD range compared against
// `finance_transactions.occurred_on`.

export type PeriodKind =
  | "today"
  | "yesterday"
  | "week"
  | "lastweek"
  | "month"
  | "lastmonth"
  | "year"
  | "lastyear"
  | "custom";

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
    case "lastweek": {
      const dow = (today.getDay() + 6) % 7;
      const lastMonday = addDays(today, -dow - 7);
      return { from: toYmd(lastMonday), to: toYmd(addDays(lastMonday, 6)) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "lastmonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "lastyear": {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31);
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
  week: "Текущая неделя",
  lastweek: "Прошлая неделя",
  month: "Текущий месяц",
  lastmonth: "Прошлый месяц",
  year: "Текущий год",
  lastyear: "Прошлый год",
  custom: "Свой период",
};

export const PERIOD_ORDER: PeriodKind[] = [
  "today",
  "yesterday",
  "week",
  "lastweek",
  "month",
  "lastmonth",
  "year",
  "lastyear",
  "custom",
];

/** Paired current/previous presets for the period popup blocks. */
export const PERIOD_BLOCKS: Array<[PeriodKind, PeriodKind]> = [
  ["today", "yesterday"],
  ["week", "lastweek"],
  ["month", "lastmonth"],
  ["year", "lastyear"],
];
