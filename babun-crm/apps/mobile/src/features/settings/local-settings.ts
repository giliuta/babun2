import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  loadCalendarSettings,
  saveCalendarSettings,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import {
  loadLoyalty,
  saveLoyalty,
  type LoyaltySettings,
} from "@babun/shared/local/loyalty";
import {
  loadLocationLabels,
  saveLocationLabels,
  type LocationLabel,
} from "@babun/shared/local/location-labels";
import {
  loadPersonalEventTypes,
  savePersonalEventTypes,
  type PersonalEventType,
} from "@babun/shared/local/personal-event-types";

export type { LocationLabel } from "@babun/shared/local/location-labels";
export type { PersonalEventType } from "@babun/shared/local/personal-event-types";

// Local (MMKV-backed) settings via the storage seam. React Query gives the
// screens a reactive cache; mutations persist + update it.
export function useCalendarSettings() {
  return useQuery({
    queryKey: ["calendar-settings"],
    queryFn: () => loadCalendarSettings(),
    staleTime: Infinity,
  });
}

export function useSaveCalendarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: CalendarSettings) => {
      saveCalendarSettings(s);
      return s;
    },
    onSuccess: (s) => qc.setQueryData(["calendar-settings"], s),
  });
}

export function useLoyalty() {
  return useQuery({
    queryKey: ["loyalty"],
    queryFn: () => loadLoyalty(),
    staleTime: Infinity,
  });
}

export function useSaveLoyalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: LoyaltySettings) => {
      saveLoyalty(s);
      return s;
    },
    onSuccess: (s) => qc.setQueryData(["loyalty"], s),
  });
}

export function useLocationLabels() {
  return useQuery({
    queryKey: ["location-labels"],
    queryFn: () => loadLocationLabels(),
    staleTime: Infinity,
  });
}

export function useSaveLocationLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: LocationLabel[]) => {
      saveLocationLabels(l);
      return l;
    },
    onSuccess: (l) => qc.setQueryData(["location-labels"], l),
  });
}

export function usePersonalEventTypes() {
  return useQuery({
    queryKey: ["event-types"],
    queryFn: () => loadPersonalEventTypes(),
    staleTime: Infinity,
  });
}

export function useSavePersonalEventTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: PersonalEventType[]) => {
      savePersonalEventTypes(t);
      return t;
    },
    onSuccess: (t) => qc.setQueryData(["event-types"], t),
  });
}
