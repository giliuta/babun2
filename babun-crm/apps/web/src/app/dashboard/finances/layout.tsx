// STORY-039 G6 — Owner-only access to /dashboard/finances.
//
// UI-level guard (column-level RLS for money fields is parked as
// STORY-039c). Server-redirects Dispatcher / Master users back to
// the calendar — they can still see appointments, just not totals.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (!tenantId) redirect("/login?error=tenant_missing");

  const { data: caller } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caller?.role !== "owner") {
    redirect("/dashboard?error=owner_only");
  }

  return <>{children}</>;
}
