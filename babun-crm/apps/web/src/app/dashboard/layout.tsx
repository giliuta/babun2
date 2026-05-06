// STORY-037 G5 — server-side auth gate.
//
// Resolves the current Supabase user + tenant via the cached
// `getTenantContext()` helper. The cache() wrapper deduplicates
// repeated calls inside one request, so child server components that
// also need tenant_id can call getTenantContext() without paying for
// extra Supabase round-trips.
//
// Either prop passes through cleanly into the client layout, or we
// redirect (no session / no tenant / not onboarded). The client
// layout still receives immutable props — no client-side fetching
// race for the same data.

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/supabase/tenant-context";
import DashboardClientLayout from "@/components/layout/DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getTenantContext();

  // No session or no resolvable tenant. Trigger handle_new_user should
  // always create one — a missing tenant therefore means RLS drift or
  // a new schema regression. Redirect with a hint param so the bug
  // surfaces instead of looping silently.
  if (!ctx) redirect("/login?error=tenant_missing");

  // STORY-040 — fresh tenants land with onboarded_at = NULL and get
  // bounced through the 4-step wizard. Pre-STORY-040 tenants were
  // backfilled with onboarded_at = created_at by the migration, so
  // existing users go straight through.
  if (!ctx.onboardedAt) redirect("/onboarding");

  return (
    <DashboardClientLayout
      tenantId={ctx.tenantId}
      tenantName={ctx.tenantName}
      userEmail={ctx.userEmail}
      emailConfirmed={ctx.emailConfirmed}
    >
      {children}
    </DashboardClientLayout>
  );
}
