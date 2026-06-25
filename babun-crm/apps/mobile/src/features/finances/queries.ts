import { useQuery } from "@tanstack/react-query";
import { listTransactionsForRange } from "@babun/shared/db/repositories/finance-transactions";
import { listAccounts } from "@babun/shared/db/repositories/accounts";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// Finance transactions over a date range (inclusive, on occurred_on) —
// TanStack Query on the shared repository (port-as-is). RLS scopes to tenant.
export function useTransactions(from: string, to: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["transactions", tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () =>
      listTransactionsForRange(supabase, tenantId as string, from, to),
  });
}

export function useAccounts() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["accounts", tenantId],
    enabled: !!tenantId,
    queryFn: () => listAccounts(supabase, tenantId as string),
  });
}
