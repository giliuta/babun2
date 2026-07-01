import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  loadEquipment,
  saveEquipment,
  type Equipment,
} from "@babun/shared/local/equipment";

export type { Equipment } from "@babun/shared/local/equipment";

export function useEquipment() {
  return useQuery({
    queryKey: ["equipment"],
    queryFn: () => loadEquipment(),
    staleTime: Infinity,
  });
}

export function useSaveEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (list: Equipment[]) => {
      saveEquipment(list);
      return list;
    },
    onSuccess: (l) => qc.setQueryData(["equipment"], l),
  });
}
