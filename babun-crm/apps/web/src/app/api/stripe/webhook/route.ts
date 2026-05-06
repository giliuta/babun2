// STORY-052 G3 — Stripe webhook receiver.
//
// Stripe POSTs subscription state transitions here. We:
//   1. Read raw body + Stripe-Signature header.
//   2. Verify via stripe.webhooks.constructEvent (HMAC + timestamp
//      tolerance).
//   3. Idempotency: INSERT into billing_events first. UNIQUE
//      constraint on stripe_event_id short-circuits a retried
//      delivery — caught + return 200 without re-applying.
//   4. Switch on event.type and reconcile tenants row state.
//
// Reconcile-via-Stripe principle: this route is the only writer of
// tenants.plan / .subscription_status / .stripe_subscription_id /
// .trial_ends_at / .current_period_end. Server actions (G2) never
// mutate those — they just bounce the user to Checkout / Portal.
// Stripe is the single source of truth.
//
// Audit trail order: insert billing_events FIRST, then mutate
// tenants. Two reasons:
//   * If the tenant write fails, we still have the event recorded
//     for forensic reprocessing.
//   * The UNIQUE constraint on stripe_event_id is our idempotency
//     primitive. A retry from Stripe → INSERT raises 23505 → we
//     skip the tenants mutation cleanly.
//
// Tenant lookup: prefer `client_reference_id` from
// checkout.session.completed (set by createCheckoutSession to our
// tenantId). Fallback to looking up `tenants` by
// `stripe_customer_id` for events that don't carry our reference
// (subscription updates after the initial checkout).

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeOrThrow, StripeNotConfiguredError } from "@/lib/stripe/client";
import { getSupabaseService } from "@/lib/supabase/service";

// Plan resolution: the Stripe Price ID maps back to one of our
// tier names. We store the price IDs in env so the same code works
// in test/live mode without rebuild.
function priceIdToTier(
  priceId: string | undefined,
): "free" | "pro" | "business" {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  // Unknown price — fall back to free so a typo'd env doesn't
  // accidentally grant Pro/Business.
  return "free";
}

interface ReconcileFields {
  plan?: "free" | "pro" | "business";
  subscription_status?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | null;
  stripe_subscription_id?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

export async function POST(req: Request) {
  // Stripe SDK availability — typed-fail without the secret key.
  let stripe: Stripe;
  try {
    stripe = getStripeOrThrow();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      // 503 because this is a configuration gap, not the caller's
      // fault. Stripe will retry; once we set the secret it will
      // catch up.
      return NextResponse.json(
        { error: "stripe_not_configured" },
        { status: 503 },
      );
    }
    throw err;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "webhook_secret_missing" },
      { status: 503 },
    );
  }

  // Raw body needed for signature verification.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // constructEvent throws on signature mismatch, expired timestamp,
    // malformed payload. All map to 400 — Stripe will not retry
    // 400-class responses.
    const msg = err instanceof Error ? err.message : "bad signature";
    // eslint-disable-next-line no-console
    console.warn("stripe webhook: signature verify failed —", msg);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const service = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbs = service as any;

  // ── Audit trail FIRST. Idempotency lives on the UNIQUE constraint
  //    on stripe_event_id; a duplicate delivery raises 23505.
  const tenantIdHint = await resolveTenantIdFromEvent(event, sbs);

  const { error: auditErr } = await sbs.from("billing_events").insert({
    tenant_id: tenantIdHint,
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
  });
  if (auditErr) {
    if ((auditErr as { code?: string }).code === "23505") {
      // Already processed — Stripe retried us. ACK.
      return NextResponse.json({ ok: true, ignored: "duplicate" });
    }
    // eslint-disable-next-line no-console
    console.error("stripe webhook: audit insert failed", auditErr);
    return NextResponse.json({ error: "audit insert failed" }, { status: 500 });
  }

  // ── Reconcile tenant state.
  try {
    await reconcile(event, tenantIdHint, sbs);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("stripe webhook: reconcile failed", err);
    // Audit row is already inserted; we acknowledge the webhook
    // (200) so Stripe doesn't retry. The forensic record is on
    // billing_events for replay.
    return NextResponse.json({ ok: true, reconcile_warning: true });
  }

  // ── STORY-069: SMS topup credit. Separate concern from
  //    subscription reconciliation, but shares idempotency via the
  //    same audit log + the UNIQUE on sms_topups.stripe_payment_intent_id.
  try {
    await maybeCreditSmsTopup(event, sbs);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("stripe webhook: sms topup credit failed", err);
    return NextResponse.json({ ok: true, topup_warning: true });
  }

  return NextResponse.json({ ok: true });
}

// ─── Tenant resolution ─────────────────────────────────────────────

async function resolveTenantIdFromEvent(
  event: Stripe.Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sbs: any,
): Promise<string | null> {
  // Prefer client_reference_id when present (checkout.session.*).
  // Stripe's union over event.data.object is enormous; cast through
  // unknown to a Record for field access.
  const data = event.data.object as unknown as Record<string, unknown>;
  const clientRef = data.client_reference_id;
  if (typeof clientRef === "string" && clientRef) return clientRef;

  // Fallback: stripe_customer_id → tenants. Field name varies by
  // event type — `customer` on subscription/invoice events.
  const customer = data.customer;
  if (typeof customer === "string" && customer) {
    const { data: row } = await sbs
      .from("tenants")
      .select("id")
      .eq("stripe_customer_id", customer)
      .maybeSingle();
    if (row?.id) return row.id as string;
  }

  // Orphan event — nothing maps. We still record it via billing_events
  // (tenant_id NULL) for forensics.
  return null;
}

// ─── Reconciler ────────────────────────────────────────────────────

async function reconcile(
  event: Stripe.Event,
  tenantId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sbs: any,
): Promise<void> {
  if (!tenantId) {
    // No tenant to update — orphan event, audit row kept for forensics.
    return;
  }

  const update = computeUpdate(event);
  if (!update) return; // event we don't care about

  await sbs.from("tenants").update(update).eq("id", tenantId);
}

function computeUpdate(event: Stripe.Event): ReconcileFields | null {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const tier = priceIdToTier(priceId);

      // Stripe status enum is broader than ours; map the values we
      // care about and map the rest to 'incomplete' (UI shows a
      // banner asking the Owner to update payment method).
      const status = mapSubscriptionStatus(sub.status);

      const update: ReconcileFields = {
        plan: tier,
        subscription_status: status,
        stripe_subscription_id: sub.id,
      };

      const subWithPeriod = sub as unknown as {
        current_period_end?: number | null;
        trial_end?: number | null;
      };
      const periodEnd = subWithPeriod.current_period_end;
      if (typeof periodEnd === "number") {
        update.current_period_end = unixToIso(periodEnd);
      }
      const trialEnd = subWithPeriod.trial_end;
      update.trial_ends_at = typeof trialEnd === "number" ? unixToIso(trialEnd) : null;

      return update;
    }

    case "customer.subscription.deleted": {
      // Subscription canceled — drop back to free, clear identifiers.
      // current_period_end stays as it was (informational).
      return {
        plan: "free",
        subscription_status: "canceled",
        stripe_subscription_id: null,
        trial_ends_at: null,
      };
    }

    case "invoice.payment_succeeded": {
      // Renewal. Stripe also fires customer.subscription.updated
      // around this event with the new current_period_end, so this
      // path is mostly belt-and-suspenders. We still bump status to
      // 'active' in case it was 'past_due'.
      return {
        subscription_status: "active",
      };
    }

    case "invoice.payment_failed": {
      // Stripe will retry per smart-retry settings. Mark past_due.
      return {
        subscription_status: "past_due",
      };
    }

    case "customer.subscription.trial_will_end":
      // Notification-only event (3 days before trial end). No
      // tenant mutation; future story wires an email/push.
      return null;

    default:
      return null;
  }
}

function mapSubscriptionStatus(
  s: Stripe.Subscription.Status,
): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
  switch (s) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
      return s;
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "past_due";
    case "paused":
      return "incomplete";
    default:
      return "incomplete";
  }
}

function unixToIso(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

// ─── STORY-069 — SMS topup credit ──────────────────────────────────
// Triggered by checkout.session.completed where metadata.kind === 'sms_topup'.
// Inserts a sms_topups row (status: completed) and bumps
// tenant_sms_config.balance_cents. Idempotency via the UNIQUE on
// sms_topups.stripe_payment_intent_id — a duplicate webhook delivery
// hits the conflict and we skip the balance update.
async function maybeCreditSmsTopup(
  event: Stripe.Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sbs: any,
): Promise<void> {
  if (event.type !== "checkout.session.completed") return;

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = (session.metadata ?? {}) as Record<string, string | undefined>;
  if (meta.kind !== "sms_topup") return;

  const tenantId = meta.tenant_id;
  const packId = meta.pack_id;
  const amountCents = Number(meta.amount_cents);
  const credits = Number(meta.credits);

  if (!tenantId || !packId || !Number.isFinite(amountCents) || !Number.isFinite(credits)) {
    // eslint-disable-next-line no-console
    console.warn("sms topup: missing metadata", meta);
    return;
  }

  // payment_intent is what we store as the idempotency key. Stripe
  // sends checkout.session.completed only after the PaymentIntent
  // succeeds, so payment_intent is always populated for paid sessions.
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    // eslint-disable-next-line no-console
    console.warn("sms topup: no payment_intent on session", session.id);
    return;
  }

  // Insert sms_topups. UNIQUE on stripe_payment_intent_id catches
  // duplicate deliveries (23505); we skip the balance bump in that case.
  const { error: insertErr } = await sbs.from("sms_topups").insert({
    tenant_id: tenantId,
    amount_cents: amountCents,
    credits_added: credits,
    pack_label: packId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      // Already credited — duplicate webhook. Don't double-bump.
      return;
    }
    throw insertErr;
  }

  // STORY-079 — atomic balance bump via the bump_sms_balance RPC.
  // Replaced the previous read-then-update pattern which lost credits
  // under concurrent webhooks for different topups on the same tenant.
  // RPC does INSERT ... ON CONFLICT DO UPDATE in a single statement,
  // so Postgres' row lock guarantees correctness.
  const { data: rpcData, error: rpcErr } = await sbs.rpc("bump_sms_balance", {
    p_tenant_id: tenantId,
    p_amount_cents: amountCents,
  });
  if (rpcErr) throw rpcErr;
  // STORY-080 — RPC returns {error: 'amount_must_be_positive'} when
  // amount<=0; throw so Stripe sees a 5xx and the audit row stays for
  // forensic review.
  if (rpcData && typeof rpcData === "object" && "error" in rpcData) {
    throw new Error(`bump_sms_balance: ${(rpcData as { error: string }).error}`);
  }
}
