"use client";

// Personal calendar event types — read / write a localStorage list.
// Lightweight hook (no context) because the data is small, used in
// only two places (PersonalEventSheet + the event-types settings
// page), and changes are user-driven so a manual refresh is fine.

import { useCallback, useEffect, useState } from "react";
import {
  loadPersonalEventTypes,
  savePersonalEventTypes,
  SEED_PERSONAL_EVENT_TYPES,
  type PersonalEventType,
} from "@babun/shared/local/personal-event-types";

const STORAGE_EVENT = "babun2:settings:personal-event-types:changed";

export function usePersonalEventTypes() {
  const [types, setTypesState] = useState<PersonalEventType[]>(
    SEED_PERSONAL_EVENT_TYPES,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypesState(loadPersonalEventTypes());
    const onChange = () => setTypesState(loadPersonalEventTypes());
    window.addEventListener(STORAGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(STORAGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setTypes = useCallback((next: PersonalEventType[]) => {
    const ordered = next.map((t, i) => ({ ...t, order: i }));
    setTypesState(ordered);
    savePersonalEventTypes(ordered);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(STORAGE_EVENT));
    }
  }, []);

  return { types, setTypes };
}
