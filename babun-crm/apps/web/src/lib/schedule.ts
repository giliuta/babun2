// Per-team work schedule, persisted in localStorage.
//
// In a future iteration this will move to Supabase, but the API surface
// (load/save/getTeamSchedule) is designed so the call sites won't change.

export interface TeamSchedule {
  start: string; // "HH:MM" — first working hour
  end: string; // "HH:MM" — last working hour (exclusive end)
}

export const DEFAULT_SCHEDULE: TeamSchedule = { start: "08:00", end: "22:00" };

const STORAGE_KEY = "babun-team-schedules";

export type ScheduleMap = Record<string, TeamSchedule>;

export function loadSchedules(): ScheduleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScheduleMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSchedules(schedules: ScheduleMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch {
    // ignore quota errors
  }
}

export function getTeamSchedule(teamId: string, schedules: ScheduleMap): TeamSchedule {
  return schedules[teamId] ?? DEFAULT_SCHEDULE;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate a list of all valid HH:00 strings for a <select>
 */
export const HOUR_OPTIONS: string[] = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);
