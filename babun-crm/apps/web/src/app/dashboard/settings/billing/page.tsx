// STORY-052 G5 — /dashboard/settings/billing.
//
// Owner-only server shell. Loads plan + usage counts + history in
// parallel, then hands off to client sections for the toasts +
// Checkout/Portal redirects.
//
// Query handling (locked spec):
//   * ?session_id=… → toast based on tenants.plan resolved by webhook
//                     (D2 surprise: webhook is single source of truth)
//                       plan === 'free'  → "Платёж обрабатывается..."
//                       plan !== 'free' → "Подписка {plan_ru} активирована"
//   * ?canceled=1   → "Оплата отменена. Можно попробовать снова."
// Both toasts are shown by the BillingToasts client component, then
// router.replace() strips the query to stop re-firing on refresh.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe/client";
import PlanCard from "@/components/settings/billing/PlanCard";
import PlanComparison from "@/components/settings/billing/PlanComparison";
import UsageDisplay from "@/components/settings/billing/UsageDisplay";
import BillingHistoryTable from "@/components/settings/billing/BillingHistoryTable";
import BillingToasts from "@/components/settings/billing/BillingToasts";
import type {
  BillingEventRow,
  BillingState,
  EffectivePlan,
  Plan,
  QuotaSummary,
  SubscriptionStatus,
  UsageCounts,
} from "@/components/settings/billing/types";

interface PageProps {
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  if (!activeTenantId) {
    const { data: m } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = m?.tenant_id ?? null;
  }
  if (!activeTenantId) redirect("/login?error=tenant_missing");

  const { data: roleRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  if (!roleRow || roleRow.role !== "owner") {
    redirect("/dashboard/settings?error=billing_owner_only");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // ── Plan + subscription state from the new tenants columns ────
  const { data: tenantRow } = await sb
    .from("tenants")
    .select(
      "plan, plan_override, subscription_status, trial_ends_at, current_period_end, stripe_subscription_id",
    )
    .eq("id", activeTenantId)
    .maybeSingle();

  const plan: Plan = (tenantRow?.plan as Plan | undefined) ?? "free";
  const planOverride = tenantRow?.plan_override as
    | "lifetime"
    | "beta_unlimited"
    | null
    | undefined;
  const effectivePlan: EffectivePlan = (planOverride ?? plan) as EffectivePlan;

  const billing: BillingState = {
    plan,
    effective_plan: effectivePlan,
    is_overridden: !!planOverride,
    subscription_status: (tenantRow?.subscription_status as SubscriptionStatus) ?? null,
    trial_ends_at: (tenantRow?.trial_ends_at as string | null) ?? null,
    current_period_end: (tenantRow?.current_period_end as string | null) ?? null,
    has_stripe_subscription: !!tenantRow?.stripe_subscription_id,
  };

  // ── Quota matrix from helper ──────────────────────────────────
  const { data: quotaJson } = await sb.rpc("tenant_quota_summary", {
    t_id: activeTenantId,
  });
  const quotas: QuotaSummary = {
    clients: 100,
    appointments_month: 50,
    team_members: 1,
    sms_month: 10,
    ...((quotaJson as Partial<QuotaSummary>) ?? {}),
  };

  // ── Live usage counts ─────────────────────────────────────────
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString();
  const [
    { count: clientsCount },
    { count: apptCount },
    { count: membersCount },
    { count: invitesCount },
    { count: smsCount },
  ] = await Promise.all([
    sb
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", activeTenantId),
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", activeTenantId)
      .gte("created_at", monthStart),
    sb
      .from("tenant_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", activeTenantId),
    sb
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", activeTenantId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    sb
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", activeTenantId)
      .gte("created_at", monthStart),
  ]);
  const usage: UsageCounts = {
    clients: clientsCount ?? 0,
    appointments_month: apptCount ?? 0,
    team_members: (membersCount ?? 0) + (invitesCount ?? 0),
    sms_month: smsCount ?? 0,
  };

  // ── Billing history (latest 50) ───────────────────────────────
  const { data: rawEvents } = await sb
    .from("billing_events")
    .select("id, stripe_event_id, event_type, payload, processed_at")
    .eq("tenant_id", activeTenantId)
    .in("event_type", ["invoice.payment_succeeded", "invoice.payment_failed"])
    .order("processed_at", { ascending: false })
    .limit(50);
  const history: BillingEventRow[] = ((rawEvents ?? []) as Array<{
    id: string;
    stripe_event_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    processed_at: string;
  }>).map((row) => {
    const obj = (row.payload?.data as { object?: Record<string, unknown> } | undefined)
      ?.object as Record<string, unknown> | undefined;
    return {
      id: row.id,
      stripe_event_id: row.stripe_event_id,
      event_type: row.event_type,
      processed_at: row.processed_at,
      invoice_url:
        (obj?.hosted_invoice_url as string | undefined) ?? null,
      amount_cents:
        typeof obj?.amount_paid === "number"
          ? (obj.amount_paid as number)
          : null,
    };
  });

  const stripeConfigured = isStripeConfigured() &&
    !!process.env.STRIPE_PRICE_PRO &&
    !!process.env.STRIPE_PRICE_BUSINESS;

  const params = (await searchParams) ?? {};

  return (
    <>
      <PageHeader title="Тариф и оплата" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <BillingToasts
            plan={billing.plan}
            sessionId={typeof params.session_id === "string" ? params.session_id : null}
            canceled={params.canceled === "1"}
          />
          <PlanCard
            billing={billing}
            stripeConfigured={stripeConfigured}
          />
          <UsageDisplay quotas={quotas} usage={usage} />
          {!stripeConfigured && (
            <div className="bg-[var(--system-orange-tint,rgba(255,149,0,0.12))] text-[var(--system-orange,#FF9500)] rounded-[12px] p-3 text-[13px]">
              Платежи временно недоступны. Свяжитесь с поддержкой, если нужно
              изменить тариф прямо сейчас.
            </div>
          )}
          {stripeConfigured && billing.plan === "free" && !billing.is_overridden && (
            <PlanComparison currentPlan={billing.plan} />
          )}
          <BillingHistoryTable rows={history} />
        </div>
      </div>
    </>
  );
}
