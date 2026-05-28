// finance_categories repository — read-only for the UI.
//
// Rows with tenant_id IS NULL are global defaults seeded in the
// 20260517_001 migration; per-tenant rows can override the slug.
// The list call returns BOTH so the UI can pick whichever is most
// specific. type ('income' / 'expense') is the primary filter.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type FinanceCategoryKind = "income" | "expense";

export interface FinanceCategory {
  id: string;
  tenant_id: string | null; // null = global default
  slug: string;
  name: string;
  type: FinanceCategoryKind;
  icon: string | null;
  color: string | null;
}

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["finance_categories"]["Row"];

function rowToCategory(r: Row): FinanceCategory {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    slug: r.slug,
    name: r.name,
    type: r.type as FinanceCategoryKind,
    icon: r.icon,
    color: r.color,
  };
}

/** Returns ALL categories visible to this tenant — globals + own. */
export async function listFinanceCategories(
  supabase: DbSupabase,
  tenantId: string,
): Promise<FinanceCategory[]> {
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listFinanceCategories: ${error.message}`);
  return ((data ?? []) as Row[]).map(rowToCategory);
}
