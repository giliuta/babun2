"use server";

// STORY-052 G2 — Stripe server actions for the billing surface.
//
// Three actions, all Owner-gated server-side via the same shape we
// use in STORY-047 SMS settings:
//
//   1. ensureStripeCustomer()      — idempotent. Returns the
//      tenant's `stripe_customer_id`, creating the Stripe Customer
//      object on first call. Email comes from the caller's session
//      (auth.users.email) — never trusted from the client.
//
//   2. createCheckoutSession({ tier, trialDays = 14 })
//      Returns a Stripe Checkout URL the client redirects to via
//      `window.location.href`. The session embeds the tenant_id in
//      `client_reference_id` so the webhook can resolve back to
//      the right row even if we somehow miss the customer mapping.
//
//   3. createPortalSession() — Self-serve subscription management.
//      Returns the Customer Portal URL.
//
// Plan changes propagate via webhook (G3), not via these actions.
// These actions only set up Stripe-side state + return URLs to
// redirect to. The webhook updates `tenants.plan` etc. Stripe is
// the single source of truth.
//
// Lazy-fail: if STRIPE_SECRET_KEY isn't set, every action returns
// `{ ok: false, error: 'stripe_not_configured' }`. Settings UI
// surfaces "Платежи временно недоступны" in that case.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import {
  getStripeOrThrow,
  getStripePriceIds,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";

// ─── Public types ────────────────────────────────────────────────

export type BillingTier = "pro" | "business";

export type BillingActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

// ─── Identity + role gate ────────────────────────────────────────

interface OwnerContext {
  userId: string;
  email: string;
  tenantId: string;
}

async function resolveOwner(): Promise<OwnerContext | { error: string }> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!user.email) return { error: "no_email_on_account" };

  // Tenant resolution — JWT app_metadata first, fallback to oldest
  // tenant_members membership. Mirrors /settings/sms shape.
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
  if (!activeTenantId) return { error: "tenant_missing" };

  // Role gate. The webhook + service-role can bypass; but every
  // human-initiated billing action requires owner.
  const { data: roleRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  if (!roleRow || roleRow.role !== "owner") return { error: "owner_only" };

  return { userId: user.id, email: user.email, tenantId: activeTenantId };
}

function mapStripeError(err: unknown): string {
  if (err instanceof StripeNotConfiguredError) return err.code;
  // Stripe Tax not configured / tax_calculation_failed surfaces as a
  // raw API error during Checkout session creation. Detect it cheaply
  // and map to a typed code so the UI can show a friendly message
  // ("Налоговая настройка не завершена. Свяжитесь с поддержкой.")
  // instead of a Stripe Dashboard URL.
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    const code = typeof e.code === "string" ? e.code : "";
    const msg = typeof e.message === "string" ? e.message : "";
    if (code === "tax_calculation_failed" || /\btax\b/i.test(msg)) {
      return "tax_not_configured";
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// ─── Action 1 — ensureStripeCustomer (idempotent) ────────────────
// Creates a Stripe Customer object on first call; on subsequent
// calls returns the existing `stripe_customer_id` cached on the
// tenants row. Used by createCheckoutSession + createPortalSession
// before they need a customer reference.

async function ensureStripeCustomerInternal(
  ctx: OwnerContext,
): Promise<{ customerId: string } | { error: string }> {
  const stripe = (() => {
    try {
      return getStripeOrThrow();
    } catch (err) {
      return { error: mapStripeError(err) } as const;
    }
  })();
  if ("error" in stripe) return stripe;

  // Cast through `any` — DB types pre-date STORY-052's tenants
  // columns (regen scheduled in STORY-052b cleanup with the SMS
  // type-cast cleanup).
  const service = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbs = service as any;

  const { data: row, error: readErr } = await sbs
    .from("tenants")
    .select("id, name, stripe_customer_id")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  if (readErr) return { error: `tenant lookup: ${readErr.message}` };
  if (!row) return { error: "tenant_missing" };

  if (row.stripe_customer_id) {
    return { customerId: row.stripe_customer_id as string };
  }

  // Create the Stripe Customer. Email is the caller's auth.users
  // email — single source of truth, never client-trusted. Metadata
  // includes our tenant_id so the Stripe Dashboard surfaces it.
  let created;
  try {
    created = await stripe.customers.create({
      email: ctx.email,
      name: (row.name as string | null) ?? undefined,
      metadata: {
        tenant_id: ctx.tenantId,
      },
    });
  } catch (err) {
    return { error: mapStripeError(err) };
  }

  const { error: updErr } = await sbs
    .from("tenants")
    .update({ stripe_customer_id: created.id })
    .eq("id", ctx.tenantId);
  if (updErr) {
    // Stripe customer was created; we couldn't persist. Rare —
    // service role should always be able to write tenants. Don't
    // delete the Stripe customer (creates audit cruft); future
    // calls will hit the same Stripe customer via the email.
    return { error: `persist customer_id: ${updErr.message}` };
  }

  return { customerId: created.id };
}

export async function ensureStripeCustomer(): Promise<
  BillingActionResult<{ customerId: string }>
> {
  const ctx = await resolveOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const r = await ensureStripeCustomerInternal(ctx);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, data: r };
}

// ─── Action 2 — createCheckoutSession ────────────────────────────

export interface CreateCheckoutInput {
  tier: BillingTier;
  /** Defaults to 14 (locked spec). Pass 0 to skip the trial. */
  trialDays?: number;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<BillingActionResult<{ url: string }>> {
  const ctx = await resolveOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const prices = getStripePriceIds();
  if (!prices) return { ok: false, error: "stripe_not_configured" };

  const stripe = (() => {
    try {
      return getStripeOrThrow();
    } catch (err) {
      return { error: mapStripeError(err) } as const;
    }
  })();
  if ("error" in stripe) return { ok: false, error: stripe.error };

  const cust = await ensureStripeCustomerInternal(ctx);
  if ("error" in cust) return { ok: false, error: cust.error };

  const priceId = input.tier === "pro" ? prices.pro : prices.business;
  const trialDays = input.trialDays ?? 14;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: cust.customerId,
      // Tenant fingerprint — the webhook resolves this on
      // checkout.session.completed even before the subscription
      // event arrives.
      client_reference_id: ctx.tenantId,
      metadata: {
        tenant_id: ctx.tenantId,
        tier: input.tier,
      },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: trialDays > 0 ? { trial_period_days: trialDays } : undefined,
      success_url:
        "https://babun.app/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://babun.app/dashboard/settings/billing?canceled=1",
      automatic_tax: { enabled: true },
      // EU consent text is a Stripe-handled placeholder; if/when we
      // add custom T&C, set `custom_text.terms_of_service_acceptance`.
    });
  } catch (err) {
    return { ok: false, error: mapStripeError(err) };
  }

  if (!session.url) return { ok: false, error: "no_session_url" };
  return { ok: true, data: { url: session.url } };
}

// ─── Action 3 — createPortalSession ──────────────────────────────

export async function createPortalSession(): Promise<
  BillingActionResult<{ url: string }>
> {
  const ctx = await resolveOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const stripe = (() => {
    try {
      return getStripeOrThrow();
    } catch (err) {
      return { error: mapStripeError(err) } as const;
    }
  })();
  if ("error" in stripe) return { ok: false, error: stripe.error };

  const cust = await ensureStripeCustomerInternal(ctx);
  if ("error" in cust) return { ok: false, error: cust.error };

  let session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: cust.customerId,
      return_url: "https://babun.app/dashboard/settings/billing",
    });
  } catch (err) {
    return { ok: false, error: mapStripeError(err) };
  }

  return { ok: true, data: { url: session.url } };
}

// ─── Convenience wrapper for the Settings page revalidation ─────

export async function revalidateBilling() {
  revalidatePath("/dashboard/settings/billing");
}
