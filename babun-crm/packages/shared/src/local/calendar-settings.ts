// Calendar display settings. Persisted in localStorage.
// Drives auto-scroll start position and grid range on the calendar.

export interface CalendarSettings {
  /** Visible-grid start hour. Determines what the user actually sees
   *  on the calendar — 0-23, default 9. Renamed conceptually in v438:
   *  treated as "visibleStartHour" but the field name stays for back-
   *  compat with any persisted localStorage entries. */
  startHour: number;
  /** Visible-grid end hour. 0-23, default 20. */
  endHour: number;
  gridStep: 15 | 30 | 60;    // minutes, default 30
  weekStart: "monday" | "sunday";
  timezone: string;           // default "Europe/Nicosia"
  // Sprint 033 Phase I35 — Bumpix-inspired calendar toggles.
  /** Minutes reserved after every appointment for travel / cleanup.
   *  New bookings can't land inside this buffer. 0 = off. */
  bufferMinutes?: number;
  /** Hide status=cancelled appointments from the calendar grid. */
  hideCancelled?: boolean;
  /** Allow an appointment to end past endHour (overflow). */
  allowOvertime?: boolean;
  // v438 — separate working hours from the visible range.
  /** Working-day start hour. The grid between work-start and work-end
   *  is highlighted (lighter background) so the user sees their work
   *  block at a glance. Falls back to startHour when undefined. */
  workStartHour?: number;
  /** Working-day end hour. Falls back to endHour when undefined. */
  workEndHour?: number;
  /** Hour the calendar auto-scrolls to on open. When undefined we
   *  use workStartHour, then startHour. */
  scrollOpenHour?: number;
}

const STORAGE_KEY = "babun2:settings:calendar";

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  startHour: 6,
  endHour: 22,
  workStartHour: 8,
  workEndHour: 20,
  scrollOpenHour: 9,
  gridStep: 30,
  weekStart: "monday",
  timezone: "Europe/Nicosia",
  bufferMinutes: 0,
  hideCancelled: false,
  allowOvertime: false,
};

export const TIMEZONE_OPTIONS: string[] = [
  "Europe/Nicosia",
  "Europe/Athens",
  "Europe/Moscow",
  "Europe/Kiev",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Jerusalem",
  "America/New_York",
  "America/Los_Angeles",
];

export function loadCalendarSettings(): CalendarSettings {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CALENDAR_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CalendarSettings>;
    return { ...DEFAULT_CALENDAR_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CALENDAR_SETTINGS;
  }
}

export function saveCalendarSettings(settings: CalendarSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function validateCalendarSettings(s: CalendarSettings): string | null {
  if (s.endHour <= s.startHour) {
    return "Конец видимого диапазона должен быть позже начала";
  }
  const ws = s.workStartHour ?? s.startHour;
  const we = s.workEndHour ?? s.endHour;
  if (we <= ws) {
    return "Конец рабочих часов должен быть позже начала";
  }
  if (ws < s.startHour || we > s.endHour) {
    return "Рабочие часы должны быть внутри видимого диапазона";
  }
  const open = s.scrollOpenHour ?? ws;
  if (open < s.startHour || open > s.endHour) {
    return "Время открытия должно быть внутри видимого диапазона";
  }
  return null;
}
