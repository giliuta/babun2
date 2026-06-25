import { useQuery } from "@tanstack/react-query";
import { listAppointments } from "@babun/shared/db/repositories/appointments";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// All tenant appointments (RLS-scoped) — shared cache key with the per-client
// hook (which adds a `select` filter on top of the same data).
export function useAppointments() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["appointments", tenantId],
    enabled: !!tenantId,
    queryFn: () => listAppointments(supabase, tenantId as string),
  });
}
