import { useQuery } from "@tanstack/react-query";
import { listAppointments } from "@babun/shared/db/repositories/appointments";
import type { Appointment } from "@babun/shared/local/appointments";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// Appointments for a single client — TanStack Query on top of the shared
// Supabase repository (port-as-is). The repo has no per-client list helper,
// so we fetch the tenant's appointments (RLS-scoped) and filter to this
// client in `select`. The list query is cached per-tenant, so opening
// several client cards reuses one network round-trip.
//
// NOTE: matches the web's client-stats fallback that also picks up legacy
// seed rows with client_id=null by name — but on mobile the selectors
// (buildStats) already do that name fallback when handed the full array, so
// here we pass through the strict client_id matches plus keep null-id rows
// out (the strict filter is enough for the live Supabase data, which always
// has client_id set on real bookings). Keeping it simple and correct.
export function useClientAppointments(clientId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["appointments", tenantId],
    enabled: !!tenantId && !!clientId,
    queryFn: () => listAppointments(supabase, tenantId as string),
    select: (all: Appointment[]) =>
      all.filter((a) => a.client_id === clientId),
  });
}
