import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createClient as createClientRepo,
  getClient,
  listClientTags,
  listClients,
  updateClient,
} from "@babun/shared/db/repositories/clients";
import { createBlankClient, type Client } from "@babun/shared/local/clients";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

// Clients list — TanStack Query on top of the shared Supabase repository
// (port-as-is). RLS scopes rows to the tenant; we pass tenantId for the index.
export function useClients() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["clients", tenantId],
    enabled: !!tenantId,
    queryFn: () => listClients(supabase, tenantId as string),
  });
}

export function useClient(id: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["client", id],
    enabled: !!tenantId && !!id,
    queryFn: () => getClient(supabase, id, tenantId as string),
  });
}

export function useUpdateClient(id: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Client>) =>
      updateClient(supabase, id, patch, tenantId as string),
    onSuccess: (updated) => {
      qc.setQueryData(["client", id], updated);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useCreateClient() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrides: Partial<Client>) =>
      createClientRepo(supabase, createBlankClient(overrides), tenantId as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// Bulk import (CSV). Creates clients sequentially via the shared repo, then
// invalidates the list once. Reports progress through onProgress.
export function useImportClients() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      drafts,
      onProgress,
    }: {
      drafts: Partial<Client>[];
      onProgress?: (done: number, total: number) => void;
    }) => {
      let created = 0;
      for (const d of drafts) {
        await createClientRepo(
          supabase,
          createBlankClient(d),
          tenantId as string,
        );
        created++;
        onProgress?.(created, drafts.length);
      }
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useClientTags() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["client-tags", tenantId],
    enabled: !!tenantId,
    queryFn: () => listClientTags(supabase, tenantId as string),
  });
}
