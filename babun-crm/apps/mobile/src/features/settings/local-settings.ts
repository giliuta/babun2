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
