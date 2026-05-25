// Pure date/time helpers shared by the time-picking surfaces
// (UnifiedTimePopup, TimeSummaryRow). Extracted so the new unified
// popup and the legacy TimeBlock don't each carry their own copy.
// No React, no side effects — safe to import anywhere.

export const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
export const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseTime(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

export function minutesToHHMM(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

export function mondayOf(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function stripDot(s: string): string {
  return s.replace(/\.$/, "");
}

export function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return stripDot(
    dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
  );
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monthShort = (d: Date) =>
    stripDot(d.toLocaleDateString("ru-RU", { month: "short" }));
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.getDate()} ${monthShort(sunday)}`;
  }
  return `${monday.getDate()} ${monthShort(monday)} – ${sunday.getDate()} ${monthShort(sunday)}`;
}

// Acceptable wheel minute steps (divisors of 60). Anything else clamps
// to 5 so the wheel list is always evenly spaced.
export const VALID_MIN_STEPS = new Set([5, 10, 15, 20, 30, 60]);

export function resolveStep(stepMinutes?: number): number {
  return stepMinutes && VALID_MIN_STEPS.has(stepMinutes) ? stepMinutes : 5;
}

// All-day events span the full day; we keep a concrete time range so
// calendar blocks still position correctly.
export const ALL_DAY_START = "00:00";
export const ALL_DAY_END = "23:59";
