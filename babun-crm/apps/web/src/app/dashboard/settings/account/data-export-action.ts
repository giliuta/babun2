"use server";

// STORY-071 GDPR — Tenant data export server action.
//
// Calls the tenant_data_export RPC under the user's session. The RPC
// is SECURITY DEFINER + role-gated to owner — passes through any
// 'no_tenant' / 'owner_only' error verbatim so the UI can surface
// the right message.

import { getSupabaseServer } from "@/lib/supabase/server";

type ExportResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export async function exportTenantData(): Promise<ExportResult> {
  const sb = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("tenant_data_export");
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Пустой ответ от сервера" };
  if (typeof data === "object" && data !== null && "error" in data) {
    const code = (data as { error: string }).error;
    if (code === "no_tenant") return { ok: false, error: "Тенант не найден" };
    if (code === "owner_only") {
      return {
        ok: false,
        error: "Только владелец может экспортировать данные",
      };
    }
    return { ok: false, error: code };
  }
  return { ok: true, data };
}
