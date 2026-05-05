"use server";

// STORY-069 — server actions for the managed-SMS settings flow.
//
// Three actions exposed:
//   * requestSenderName(name)  — submit Sender ID for owner approval
//   * cancelSenderRequest()    — withdraw a pending request
//   * createTopupCheckout(pack)— Stripe Checkout for balance top-up
//                                (wave 2; stub returns "soon" for now)
//
// All actions assert owner role + tenant ownership server-side. The
// service-role bypass on tenant_sms_config means the UPDATE itself
// runs without touching RLS, but we still scope to the requesting
// tenant via the auth.users session — never trust a tenant_id from
// the client payload.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import { getStripeOrThrow, StripeNotConfiguredError } from "@/lib/stripe/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { TOPUP_PACKS } from "./sms-constants";

type ActionResult = { ok: true } | { ok: false; error: string };

async function resolveOwnerTenantId(): Promise<{
  tenantId: string;
  userId: string;
  email: string;
} | null> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !user.email) return null;

  const jwt = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let tenantId = jwt ?? null;
  if (!tenantId) {
    const { data: m } = await sb
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = m?.tenant_id ?? null;
  }
  if (!tenantId) return null;

  const { data: membership } = await sb
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!membership || membership.role !== "owner") return null;

  return { tenantId, userId: user.id, email: user.email };
}

// ── Sender ID request ────────────────────────────────────────────
//
// Twilio Alphanumeric Sender ID rules (Cyprus + general EU):
//   * 1–11 chars, A-Z / a-z / 0-9 / spaces
//   * Must contain at least one letter (purely-numeric IDs reject)
//   * No special chars (operators strip them and delivery fails)
const SENDER_PATTERN = /^[A-Za-z0-9 ]{1,11}$/;
const SENDER_MUST_HAVE_LETTER = /[A-Za-z]/;

export async function requestSenderName(
  name: string,
): Promise<ActionResult> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может настраивать SMS" };
  }

  const rl = checkRateLimit(`sender:${auth.userId}`, RATE_LIMITS.senderRequest);
  if (!rl.allowed) {
    return { ok: false, error: "Слишком часто — подождите пару минут" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Введите имя отправителя" };
  }
  if (trimmed.length > 11) {
    return { ok: false, error: "Максимум 11 символов" };
  }
  if (!SENDER_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Только латинские буквы, цифры и пробел",
    };
  }
  if (!SENDER_MUST_HAVE_LETTER.test(trimmed)) {
    return { ok: false, error: "Должна быть хотя бы одна буква" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("tenant_sms_config").upsert(
    {
      tenant_id: auth.tenantId,
      sender_name: trimmed,
      sender_status: "pending",
      sender_requested_at: new Date().toISOString(),
      sender_approved_at: null,
      sender_rejection_reason: null,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    return { ok: false, error: `Не удалось сохранить: ${error.message}` };
  }

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}

export async function cancelSenderRequest(): Promise<ActionResult> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может настраивать SMS" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("tenant_sms_config")
    .update({
      sender_name: null,
      sender_status: null,
      sender_requested_at: null,
      sender_approved_at: null,
      sender_rejection_reason: null,
    })
    .eq("tenant_id", auth.tenantId)
    .eq("sender_status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}

// ── Stripe top-up Checkout (wave 2) ──────────────────────────────
//
// Creates a one-shot Stripe Checkout Session in `payment` mode (no
// subscription) for the chosen SMS pack. Webhook
// `checkout.session.completed` handles `metadata.kind === 'sms_topup'`
// and credits balance_cents + inserts an sms_topups row.
//
// Idempotency lives on sms_topups.stripe_payment_intent_id (UNIQUE).
//
// We reuse tenants.stripe_customer_id when present so the customer's
// Stripe Dashboard view shows topups + subscription under one
// customer object. Created lazily on first topup if absent.
export async function createTopupCheckout(packId: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может пополнять баланс" };
  }

  const rl = checkRateLimit(`topup:${auth.userId}`, RATE_LIMITS.topupCheckout);
  if (!rl.allowed) {
    return { ok: false, error: "Слишком частые попытки оплаты — подождите минуту" };
  }

  const pack = TOPUP_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return { ok: false, error: "Неизвестный пакет пополнения" };
  }

  let stripe;
  try {
    stripe = getStripeOrThrow();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return { ok: false, error: "Платежи временно недоступны" };
    }
    return { ok: false, error: "Не удалось подключить Stripe" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbs = svc as any;

  // Reuse or create Stripe customer. Same pattern as billing/actions.ts
  // ensureStripeCustomer — keep topups under the same customer object.
  const { data: tenantRow, error: tenantErr } = await sbs
    .from("tenants")
    .select("id, name, stripe_customer_id")
    .eq("id", auth.tenantId)
    .maybeSingle();
  if (tenantErr || !tenantRow) {
    return { ok: false, error: "Тенант не найден" };
  }

  let customerId: string | null = tenantRow.stripe_customer_id ?? null;
  if (!customerId) {
    try {
      const created = await stripe.customers.create({
        email: auth.email,
        name: (tenantRow.name as string | null) ?? undefined,
        metadata: { tenant_id: auth.tenantId },
      });
      customerId = created.id;
      await sbs
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", auth.tenantId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "stripe customer create failed";
      return { ok: false, error: msg };
    }
  }

  // Create the Checkout Session in payment mode. EUR — same currency
  // as the subscription tiers. We don't rely on Stripe Products /
  // Prices for topups: the amount is set ad-hoc per session so we can
  // tweak pack pricing without re-creating Stripe price objects.
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: auth.tenantId,
      metadata: {
        kind: "sms_topup",
        tenant_id: auth.tenantId,
        pack_id: pack.id,
        amount_cents: String(pack.amountCents),
        credits: String(pack.credits),
      },
      payment_intent_data: {
        // Mirror the metadata onto the PaymentIntent so the webhook
        // can use it directly when the event arrives there.
        metadata: {
          kind: "sms_topup",
          tenant_id: auth.tenantId,
          pack_id: pack.id,
          amount_cents: String(pack.amountCents),
          credits: String(pack.credits),
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: pack.amountCents,
            product_data: {
              name: `Babun · SMS пакет «${pack.label}» — ${pack.credits} SMS`,
            },
          },
        },
      ],
      success_url:
        "https://babun.app/dashboard/settings/sms?topup_status=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://babun.app/dashboard/settings/sms?topup_status=canceled",
      // Stripe Checkout shows our Terms link below the pay button.
      // Requires Stripe Dashboard → Settings → Public business info →
      // Terms of service URL = https://babun.app/terms.
      consent_collection: {
        terms_of_service: "required",
      },
      // Topups are one-shot purchases — no automatic_tax for now to
      // skip the Stripe Tax dependency. Subscription billing handles
      // tax via the recurring price object.
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe checkout failed";
    return { ok: false, error: msg };
  }

  if (!session.url) {
    return { ok: false, error: "no_session_url" };
  }
  return { ok: true, url: session.url };
}
