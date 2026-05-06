"use server";

// Marks the tenant as onboarded and busts the tenant-context cache so
// the dashboard doesn't bounce the user back to /onboarding for the
// remainder of the unstable_cache TTL window.
//
// Replaces the direct supabase.from("tenants").update(...) call that
// OnboardingWizard used to make from the client — staying on the
// client meant we couldn't call revalidateTag, so a freshly-onboarded
// user could redirect-loop until the cache TTL expired.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Vertical } from "@/components/onboarding/OnboardingWizard";

interface Args {
  tenantId: string;
  name: string;
  vertical: Vertical;
  personalCalendar: boolean;
}

type Result = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(args: Args): Promise<Result> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  // Sanity: don't let a session for tenant A complete onboarding for
  // tenant B. RLS already enforces this, but a friendly error is nicer
  // than a generic 401 from Postgres.
  const sessionTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (sessionTenantId !== args.tenantId) {
    return { ok: false, error: "tenant_mismatch" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("tenants")
    .update({
      name: args.name.trim(),
      vertical: args.vertical,
      personal_calendar_enabled: args.personalCalendar,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", args.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
