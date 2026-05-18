// Team-calendar event types. Same shape as PersonalEventType but
// scoped per-brigade (one list per team_id) so each brigade can
// have its own set of "kinds" of events for the chip row above
// the title in the team-calendar "Новое событие" form.
//
// Storage key: `babun2:settings:team-event-types:{teamId}`.
// Each brigade's list seeds with the same defaults as personal
// on first read.

import type {
  PersonalEventType,
  PersonalEventTypeIcon,
} from "./personal-event-types";
import { SEED_PERSONAL_EVENT_TYPES } from "./personal-event-types";

export type TeamEventType = PersonalEventType;
export type TeamEventTypeIcon = PersonalEventTypeIcon;

export const SEED_TEAM_EVENT_TYPES: TeamEventType[] = SEED_PERSONAL_EVENT_TYPES;

function storageKey(teamId: string): string {
  return `babun2:settings:team-event-types:${teamId}`;
}

export function loadTeamEventTypes(teamId: string): TeamEventType[] {
  if (typeof window === "undefined") return SEED_TEAM_EVENT_TYPES;
  if (!teamId) return SEED_TEAM_EVENT_TYPES;
  try {
    const raw = window.localStorage.getItem(storageKey(teamId));
    if (!raw) return SEED_TEAM_EVENT_TYPES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return SEED_TEAM_EVENT_TYPES;
    }
    return parsed
      .map((p, i) => ({
        id: String(p.id ?? `tet-${Date.now()}-${i}`),
        label: String(p.label ?? "").trim() || "Без названия",
        icon: (p.icon ?? "tag") as PersonalEventTypeIcon,
        color: String(p.color ?? "#007AFF"),
        defaultDuration: Number.isFinite(p.defaultDuration)
          ? Math.max(5, Math.min(24 * 60, Number(p.defaultDuration)))
          : 60,
        allDay: Boolean(p.allDay),
        order: Number.isFinite(p.order) ? Number(p.order) : i,
      }))
      .sort((a, b) => a.order - b.order);
  } catch {
    return SEED_TEAM_EVENT_TYPES;
  }
}

export function saveTeamEventTypes(
  teamId: string,
  types: TeamEventType[],
): void {
  if (typeof window === "undefined") return;
  if (!teamId) return;
  try {
    window.localStorage.setItem(storageKey(teamId), JSON.stringify(types));
  } catch {
    // ignore quota errors
  }
}

export function generateTeamEventTypeId(): string {
  return `tet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
