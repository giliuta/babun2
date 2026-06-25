import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Database } from "@babun/shared/db/database.types";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/lib/tenant";

type Tables = Database["public"]["Tables"];
export type Team = Tables["teams"]["Row"];
export type Master = Tables["masters"]["Row"];
export type City = Tables["cities"]["Row"];

// ─── Teams ───────────────────────────────────────────────────────────
export function useTeams() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["teams", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("tenant_id", tenantId as string)
        .eq("is_active", true)
        .order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useCreateTeam() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; region?: string }) => {
      const { data, error } = await supabase
        .from("teams")
        .insert({
          id: `team_${Date.now()}`,
          tenant_id: tenantId as string,
          name: input.name,
          region: input.region || null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

// ─── Masters ─────────────────────────────────────────────────────────
export function useMasters() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["masters", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("masters")
        .select("*")
        .eq("tenant_id", tenantId as string)
        .eq("is_active", true)
        .order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useCreateMaster() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { full_name: string; phone?: string }) => {
      const { data, error } = await supabase
        .from("masters")
        .insert({
          id: `master_${Date.now()}`,
          tenant_id: tenantId as string,
          full_name: input.full_name,
          phone: input.phone || null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters"] }),
  });
}

// ─── Cities ──────────────────────────────────────────────────────────
export function useCities() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["cities", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .eq("tenant_id", tenantId as string)
        .eq("is_active", true)
        .order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useCreateCity() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; country?: string }) => {
      const { data, error } = await supabase
        .from("cities")
        .insert({
          id: `city_${Date.now()}`,
          tenant_id: tenantId as string,
          name: input.name,
          country: input.country || "",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities"] }),
  });
}
