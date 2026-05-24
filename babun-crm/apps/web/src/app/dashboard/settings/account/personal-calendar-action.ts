"use server";

// STORY-073 — owner-only toggle for tenants.personal_calendar_enabled.
//
// Flips the boolean. RLS already gates this update to the owner via
// tenants_update_own; we still resolve the user server-side as a
// belt-and-suspenders.
//
// No revalidatePath: every page that depends on this flag reads it
// through the client `usePersonalCalendarEnabled` hook, which already
// caches in localStorage (v668) and refreshes on mount. A
// revalidatePath here would trigger router.refresh() on the dashboard
// layout for every toggle tap and added 200–500 ms of perceptible
// lag for nothing.

import { getSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function setPersonalCalendarEnabled(
  enabled: boolean,
): Promise<Result> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (!tenantId) return { ok: false, error: "tenant_missing" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("tenants")
    .update({ personal_calendar_enabled: enabled })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
