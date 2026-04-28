// STORY-040 — onboarding server gate.
//
// Mirrors the dashboard layout's pattern: validate the session, fetch
// the user's tenant, redirect on broken / already-onboarded states.
// The wizard itself is a client component below.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import OnboardingWizard, {
  type Vertical,
} from "@/components/onboarding/OnboardingWizard";

const KNOWN_VERTICALS: Vertical[] = [
  "hvac",
  "beauty",
  "auto",
  "cleaning",
  "other",
];

function asVertical(v: string | null | undefined): Vertical | null {
  if (!v) return null;
  return (KNOWN_VERTICALS as string[]).includes(v) ? (v as Vertical) : null;
}

export default async function OnboardingPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, vertical, city, onboarded_at")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error || !tenant) {
    redirect("/login?error=tenant_missing");
  }
  if (tenant.onboarded_at) {
    redirect("/dashboard/clients");
  }

  // Step 1 pre-fill heuristic (A6): the trigger from STORY-037 sets
  // tenants.name = coalesce(business_name, email). If it looks like
  // an email, treat as empty so the placeholder shows.
  const initialName =
    tenant.name && !tenant.name.includes("@") ? tenant.name : "";

  return (
    <OnboardingWizard
      tenantId={tenant.id}
      initialName={initialName}
      initialVertical={asVertical(tenant.vertical)}
      initialCity={tenant.city ?? ""}
    />
  );
}
