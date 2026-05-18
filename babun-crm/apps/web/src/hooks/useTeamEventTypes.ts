"use client";

// Team-calendar event types — read / write a per-brigade list scoped
// in localStorage by team_id. Mirrors usePersonalEventTypes but keyed
// per brigade so each team can curate its own chip row.

import { useCallback, useEffect, useState } from "react";
import {
  loadTeamEventTypes,
  saveTeamEventTypes,
  SEED_TEAM_EVENT_TYPES,
  type TeamEventType,
} from "@babun/shared/local/team-event-types";

const STORAGE_EVENT_PREFIX = "babun2:settings:team-event-types:changed:";

export function useTeamEventTypes(teamId: string | null) {
  const [types, setTypesState] = useState<TeamEventType[]>(
    SEED_TEAM_EVENT_TYPES,
  );

  useEffect(() => {
    if (!teamId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTypesState(SEED_TEAM_EVENT_TYPES);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypesState(loadTeamEventTypes(teamId));
    const channel = `${STORAGE_EVENT_PREFIX}${teamId}`;
    const onChange = () => setTypesState(loadTeamEventTypes(teamId));
    window.addEventListener(channel, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(channel, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [teamId]);

  const setTypes = useCallback(
    (next: TeamEventType[]) => {
      if (!teamId) return;
      const ordered = next.map((t, i) => ({ ...t, order: i }));
      setTypesState(ordered);
      saveTeamEventTypes(teamId, ordered);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(`${STORAGE_EVENT_PREFIX}${teamId}`));
      }
    },
    [teamId],
  );

  return { types, setTypes };
}
