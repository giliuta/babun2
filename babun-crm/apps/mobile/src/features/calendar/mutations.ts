import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from "@babun/shared/db/repositories/appointments";
import type { Appointment } from "@babun/shared/local/appointments";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// Appointment writes go through the shared repo (same as web). Completing an
// appointment triggers finance income sync server-side, so we also invalidate
// the finance queries.
function invalidateKeys() {
  return [["appointments"], ["transactions"], ["clients"]];
}

export function useCreateAppointment() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Appointment) =>
      createAppointment(supabase, input, tenantId as string),
    onSuccess: () => {
      for (const key of invalidateKeys()) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateAppointment() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Appointment> }) =>
      updateAppointment(supabase, id, patch, tenantId as string),
    onSuccess: () => {
      for (const key of invalidateKeys()) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteAppointment() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      deleteAppointment(supabase, id, tenantId as string),
    onSuccess: () => {
      for (const key of invalidateKeys()) qc.invalidateQueries({ queryKey: key });
    },
  });
}
