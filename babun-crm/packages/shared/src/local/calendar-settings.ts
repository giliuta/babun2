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
  // v439 — visible range covers the whole day (00:00 → 24:00) so the
  // user can place a late event without changing settings first; the
  // grid greys out anything outside workStartHour..workEndHour to
  // visually separate "off-hours" from the work block.
  startHour: 0,
  endHour: 24,
  workStartHour: 6,
  workEndHour: 22,
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
    const merged = { ...DEFAULT_CALENDAR_SETTINGS, ...parsed };
    return sanitizeCalendarSettings(merged);
  } catch {
    return DEFAULT_CALENDAR_SETTINGS;
  }
}

// Repair settings loaded from older saves. v448 — flipped clamp
// direction: if a saved row has work/scroll-open OUTSIDE the visible
// range, EXPAND the visible range to include it. Previously work/
// scroll were silently snapped back into [startHour..endHour], which
// produced the "settings save+revert" surprise on the form.
function sanitizeCalendarSettings(s: CalendarSettings): CalendarSettings {
  const next = { ...s };

  // Hard bounds: visible range stays inside [0..24] and ≥ 1 h wide.
  next.startHour = Math.max(0, Math.min(23, next.startHour));
  next.endHour = Math.max(next.startHour + 1, Math.min(24, next.endHour));

  // Expand visible to fit work / scroll-open — they win.
  const ws = next.workStartHour ?? next.startHour;
  const we = next.workEndHour ?? next.endHour;
  const open = next.scrollOpenHour ?? ws;
  if (Number.isFinite(ws) && ws < next.startHour) next.startHour = Math.max(0, ws);
  if (Number.isFinite(we) && we > next.endHour) next.endHour = Math.min(24, we);
  if (Number.isFinite(open)) {
    if (open < next.startHour) next.startHour = Math.max(0, open);
    if (open > next.endHour) next.endHour = Math.min(24, open);
  }

  // Final clamp — work / scroll-open inside the (possibly expanded)
  // visible range, with a 1-hour minimum work band.
  next.workStartHour = Math.max(
    next.startHour,
    Math.min(ws, next.endHour - 1),
  );
  next.workEndHour = Math.min(
    next.endHour,
    Math.max(we, next.startHour + 1),
  );
  next.scrollOpenHour = Math.max(
    next.startHour,
    Math.min(open, next.endHour),
  );

  return next;
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
  // endHour can be 24 — treated as "midnight at the end of day".
  if (s.endHour <= s.startHour) {
    return "Конец видимого диапазона должен быть позже начала";
  }
  if (s.endHour > 24 || s.startHour < 0) {
    return "Часы вне диапазона 00–24";
  }
  const ws = s.workStartHour ?? s.startHour;
  const we = s.workEndHour ?? s.endHour;
  if (we <= ws) {
    return "Конец рабочих часов должен быть позже начала";
  }
  // v448 — visible range is auto-expanded to include work / scroll-
  // open by the patcher + sanitizer. We no longer reject when work /
  // scroll-open fall outside visible; that situation is repaired on
  // load instead of blocking Save.
  return null;
}

// Helper for event/appointment forms: returns true when an event
// scheduled at `startMin` (minutes from midnight) lasting
// `durationMin` either starts before workStartHour, ends after
// workEndHour, or both. The form reads this on Save and shows a
// warning + confirm dialog ("выходит за рабочую норму, всё равно
// сохранить?") before persisting.
export function isOutsideWorkHours(
  startMin: number,
  durationMin: number,
  s: CalendarSettings,
): boolean {
  const ws = (s.workStartHour ?? s.startHour) * 60;
  const we = (s.workEndHour ?? s.endHour) * 60;
  const endMin = startMin + durationMin;
  return startMin < ws || endMin > we;
}
