// STORY-037 G5 — server-side auth gate.
//
// Resolves the current Supabase user via cookie, fails over to
// /login if missing, then resolves the user's tenant from the
// `tenants` table (one-row guarantee provided by the
// handle_new_user trigger from G1). Both are passed as immutable
// props into the existing client layout — this avoids the
// race-conditions a client-side useEffect would introduce.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import DashboardClientLayout from "@/components/layout/DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();

  // Validates the session cookie against Supabase Auth — getUser()
  // is preferred over getSession() because the latter trusts a
  // potentially forged JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // STORY-039 — resolve active tenant via tenant_members. Prefer the
  // JWT's app_metadata.tenant_id when present; fall back to the user's
  // first membership (oldest joined_at) for the fresh-signup race
  // where the JWT predates the trigger stamp.
  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  if (!activeTenantId) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = membership?.tenant_id ?? null;
  }
  if (!activeTenantId) {
    redirect("/login?error=tenant_missing");
  }
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, onboarded_at")
    .eq("id", activeTenantId)
    .maybeSingle();

  if (error || !tenant) {
    // Trigger should always create one. Defensive redirect with a
    // hint param so the bug surfaces instead of looping silently.
    redirect("/login?error=tenant_missing");
  }
  // STORY-040 — fresh tenants land with onboarded_at = NULL and get
  // bounced through the 4-step wizard. Pre-STORY-040 tenants were
  // backfilled with onboarded_at = created_at by the migration, so
  // existing users go straight through.
  if (!tenant.onboarded_at) {
    redirect("/onboarding");
  }

  return (
    <DashboardClientLayout
      tenantId={tenant.id}
      tenantName={tenant.name}
      userEmail={user.email ?? ""}
      emailConfirmed={Boolean(user.email_confirmed_at)}
    >
      {children}
    </DashboardClientLayout>
  );
}
