import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Database } from "@babun/shared/db/database.types";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

export function useTenant() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId as string)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useUpdateTenant() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TenantUpdate) => {
      const { error } = await supabase
        .from("tenants")
        .update(patch)
        .eq("id", tenantId as string);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
}
