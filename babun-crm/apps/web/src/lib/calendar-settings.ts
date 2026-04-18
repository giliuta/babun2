// Calendar display settings. Persisted in localStorage.
// Drives auto-scroll start position and grid range on the calendar.

export interface CalendarSettings {
  startHour: number;          // 0-23, default 9
  endHour: number;            // 1-24, default 20
  gridStep: 15 | 30 | 60;    // minutes, default 30
  weekStart: "monday" | "sunday";
  timezone: string;           // default "Europe/Nicosia"
}

const STORAGE_KEY = "babun2:settings:calendar";

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  startHour: 9,
  endHour: 20,
  gridStep: 30,
  weekStart: "monday",
  timezone: "Europe/Nicosia",
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
    return "Конец дня должен быть позже начала";
  }
  return null;
}
