// STORY-040 + STORY-073 — onboarding server gate.
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

  // STORY-039 — resolve active tenant via tenant_members.
  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  // STORY-079 — distinguish transient lookup errors from terminal
  // "no membership exists" so a flaky network doesn't strand the
  // user on /login?error=tenant_missing forever.
  let lookupTransientError = false;
  if (!activeTenantId) {
    const { data: membership, error: memErr } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (memErr) {
      lookupTransientError = true;
    }
    activeTenantId = membership?.tenant_id ?? null;
  }

  if (lookupTransientError) {
    return <TransientLoadError />;
  }
  if (!activeTenantId) {
    redirect("/login?error=tenant_missing");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error } = await (supabase as any)
    .from("tenants")
    .select("id, name, vertical, personal_calendar_enabled, onboarded_at")
    .eq("id", activeTenantId)
    .maybeSingle();

  if (error) {
    return <TransientLoadError />;
  }
  if (!tenant) {
    redirect("/login?error=tenant_missing");
  }
  if (tenant.onboarded_at) {
    redirect("/dashboard");
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
      // v526 §3.2 — pre-onboarding tenants haven't decided yet, so
      // we pre-select «Личный календарь» as the safe default. The
      // most common signup shape is a solo owner; team workflows are
      // a one-tap flip on Step 3. Onboarded tenants get redirected
      // away at line ~75 so they never see this pre-select.
      initialPersonalCalendar={
        tenant.personal_calendar_enabled === false
          ? false
          : true
      }
    />
  );
}

// STORY-079 — transient lookup-error fallback. Renders inline instead
// of bouncing to /login so the user can retry without losing context.
function TransientLoadError() {
  return (
    <main className="min-h-[100dvh] bg-[var(--surface-grouped)] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center space-y-3">
        <h1 className="text-[18px] font-semibold text-[var(--label)]">
          Не удалось загрузить аккаунт
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Похоже, что-то с подключением. Перезагрузи страницу — обычно помогает.
        </p>
        <a
          href="/onboarding"
          className="inline-flex h-11 px-5 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold items-center justify-center"
        >
          Повторить
        </a>
      </div>
    </main>
  );
}
