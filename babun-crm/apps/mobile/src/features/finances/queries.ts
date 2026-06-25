import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteTransaction,
  insertTransaction,
  listTransactionsForRange,
  type TransactionDraft,
} from "@babun/shared/db/repositories/finance-transactions";
import { listAccounts } from "@babun/shared/db/repositories/accounts";
import {
  deleteFinanceCategory,
  insertFinanceCategory,
  listFinanceCategories,
  type NewFinanceCategory,
} from "@babun/shared/db/repositories/finance-categories";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// Finance transactions over a date range (inclusive on occurred_on),
// optionally scoped to teams (brigadeIds). RLS scopes to tenant.
export function useTransactions(
  from: string,
  to: string,
  brigadeIds?: string[],
) {
  const tenantId = useTenantId();
  const scope = brigadeIds?.length ? brigadeIds : null;
  return useQuery({
    queryKey: ["transactions", tenantId, from, to, scope],
    enabled: !!tenantId,
    queryFn: () =>
      listTransactionsForRange(
        supabase,
        tenantId as string,
        from,
        to,
        scope ? { brigadeIds: scope } : undefined,
      ),
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

export function useFinanceCategories() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["finance-categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => listFinanceCategories(supabase, tenantId as string),
  });
}

export function useInsertTransaction() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: TransactionDraft) =>
      insertTransaction(supabase, tenantId as string, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useInsertCategory() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: NewFinanceCategory) =>
      insertFinanceCategory(supabase, tenantId as string, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFinanceCategory(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-categories"] }),
  });
}
