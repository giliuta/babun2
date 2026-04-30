// STORY-039 G3 — Team management.
//
// Server-resolves the active tenant via JWT app_metadata + falls back
// to tenant_members for fresh-signup race. Hands off to a client
// component that fetches members + pending invitations on the user-
// scoped client (RLS gates everything).

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import TeamSettingsClient from "@/components/settings/team/TeamSettingsClient";

export default async function TeamSettingsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenantId =
    (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    null;
  if (!tenantId) redirect("/login?error=tenant_missing");

  // Pre-resolve caller's role so the UI doesn't need a round-trip
  // before deciding which controls to render.
  const { data: caller } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  const callerRole = caller?.role ?? "member";

  return (
    <>
      <PageHeader title="Команда" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
          <TeamSettingsClient
            tenantId={tenantId}
            callerUserId={user.id}
            callerRole={callerRole}
          />
        </div>
      </div>
    </>
  );
}
