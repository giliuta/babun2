// STORY-052 G3 — offline regression suite for /api/stripe/webhook.
//
// Strategy mirrors STORY-047 G6 Twilio test: in-memory mock of the
// Supabase service client + signed bodies built with the same
// algorithm Stripe SDK uses (HMAC-SHA256 over `t=...|payload`).
//
// The Stripe SDK exposes `webhooks.generateTestHeaderString()` for
// exactly this purpose — we use it to forge a valid signature for
// each test, then exercise the route via its exported POST handler.

import { describe, it, expect, beforeEach, vi } from "vitest";
import Stripe from "stripe";

// ─── Module mocks (must precede route import) ────────────────────

const mockState: {
  insertedEvents: Array<{ tenant_id: string | null; stripe_event_id: string; event_type: string }>;
  tenantUpdates: Array<{ id: string; patch: Record<string, unknown> }>;
  tenantsByStripeCustomer: Map<string, { id: string }>;
  /** Toggle to simulate an idempotency hit (Postgres 23505 unique violation). */
  failNextInsertWith23505: boolean;
} = {
  insertedEvents: [],
  tenantUpdates: [],
  tenantsByStripeCustomer: new Map(),
  failNextInsertWith23505: false,
};

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseService: () => ({
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (table === "billing_events") {
            if (mockState.failNextInsertWith23505) {
              mockState.failNextInsertWith23505 = false;
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key" },
              });
            }
            mockState.insertedEvents.push({
              tenant_id: (row.tenant_id as string | null) ?? null,
              stripe_event_id: row.stripe_event_id as string,
              event_type: row.event_type as string,
            });
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        select(_cols: string) {
          return {
            eq(_col: string, val: string) {
              return {
                async maybeSingle() {
                  if (table === "tenants") {
                    return {
                      data: mockState.tenantsByStripeCustomer.get(val) ?? null,
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(_col: string, val: string) {
              if (table === "tenants") {
                mockState.tenantUpdates.push({ id: val, patch });
              }
              return { error: null };
            },
          };
        },
      };
    },
  }),
}));

// ─── Pull the route AFTER the mock is registered ─────────────────

import { POST } from "@/app/api/stripe/webhook/route";

// ─── Test fixtures ───────────────────────────────────────────────

const TEST_SECRET = "whsec_test_only_not_real";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CUSTOMER_ID = "cus_test_customer_001";
const SUB_ID = "sub_test_001";
const PRO_PRICE = "price_pro_test";
const BUSINESS_PRICE = "price_business_test";

beforeEach(() => {
  mockState.insertedEvents = [];
  mockState.tenantUpdates = [];
  mockState.tenantsByStripeCustomer = new Map();
  mockState.failNextInsertWith23505 = false;
  process.env.STRIPE_SECRET_KEY = "sk_test_only_not_real";
  process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  process.env.STRIPE_PRICE_PRO = PRO_PRICE;
  process.env.STRIPE_PRICE_BUSINESS = BUSINESS_PRICE;
});

function makeStripe(): Stripe {
  return new Stripe("sk_test_only_not_real", {
    apiVersion: "2025-08-27.basil",
  });
}

function signedRequest(payload: object): Request {
  const stripe = makeStripe();
  const body = JSON.stringify(payload);
  const sig = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: TEST_SECRET,
  });
  return new Request("http://internal/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

function subscriptionEvent(opts: {
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  status: Stripe.Subscription.Status;
  priceId: string;
  clientReferenceId?: string;
  customer?: string;
  trialEnd?: number | null;
  currentPeriodEnd?: number;
}): object {
  const sub: Record<string, unknown> = {
    id: SUB_ID,
    object: "subscription",
    status: opts.status,
    customer: opts.customer ?? CUSTOMER_ID,
    items: {
      data: [{ price: { id: opts.priceId } }],
    },
    trial_end: opts.trialEnd ?? null,
    current_period_end: opts.currentPeriodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400,
  };
  if (opts.clientReferenceId) sub.client_reference_id = opts.clientReferenceId;
  return {
    id: `evt_${opts.type.replace(/\./g, "_")}_${Math.random().toString(36).slice(2, 7)}`,
    type: opts.type,
    data: { object: sub },
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("/api/stripe/webhook — signature verification", () => {
  it("Case 1 — valid signature + subscription.created → 200, billing_events inserted, tenants updated", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "trialing",
      priceId: PRO_PRICE,
      trialEnd: Math.floor(Date.now() / 1000) + 14 * 86400,
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.insertedEvents).toHaveLength(1);
    expect(mockState.insertedEvents[0].event_type).toBe("customer.subscription.created");
    expect(mockState.tenantUpdates).toHaveLength(1);
    expect(mockState.tenantUpdates[0].patch).toMatchObject({
      plan: "pro",
      subscription_status: "trialing",
      stripe_subscription_id: SUB_ID,
    });
  });

  it("Case 2 — wrong signature → 400, no DB writes", async () => {
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "active",
      priceId: PRO_PRICE,
    });
    const body = JSON.stringify(event);
    const req = new Request("http://internal/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef", // forged
      },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockState.insertedEvents).toHaveLength(0);
    expect(mockState.tenantUpdates).toHaveLength(0);
  });

  it("Case 3 — missing stripe-signature header → 400", async () => {
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "active",
      priceId: PRO_PRICE,
    });
    const req = new Request("http://internal/api/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("/api/stripe/webhook — idempotency + reconcile mapping", () => {
  it("Case 4 — duplicate event (23505) → 200 ignored, no tenant update", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    mockState.failNextInsertWith23505 = true;
    const event = subscriptionEvent({
      type: "customer.subscription.updated",
      status: "active",
      priceId: PRO_PRICE,
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe("duplicate");
    expect(mockState.tenantUpdates).toHaveLength(0);
  });

  it("Case 5 — subscription.deleted → plan='free', stripe_subscription_id=null", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    const event = subscriptionEvent({
      type: "customer.subscription.deleted",
      status: "canceled",
      priceId: PRO_PRICE,
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.tenantUpdates[0].patch).toMatchObject({
      plan: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      trial_ends_at: null,
    });
  });

  it("Case 6 — invoice.payment_failed → past_due", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    const event = {
      id: "evt_inv_failed_001",
      type: "invoice.payment_failed",
      data: { object: { customer: CUSTOMER_ID, object: "invoice" } },
    };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.tenantUpdates[0].patch).toEqual({
      subscription_status: "past_due",
    });
  });

  it("Case 7 — invoice.payment_succeeded → active (recovery from past_due)", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    const event = {
      id: "evt_inv_ok_001",
      type: "invoice.payment_succeeded",
      data: { object: { customer: CUSTOMER_ID, object: "invoice" } },
    };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.tenantUpdates[0].patch).toEqual({
      subscription_status: "active",
    });
  });
});

describe("/api/stripe/webhook — tenant resolution + price mapping", () => {
  it("Case 8 — client_reference_id wins over customer lookup", async () => {
    // Customer lookup would resolve to a different tenant; client_ref
    // should be used directly.
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, {
      id: "wrong-tenant-id",
    });
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "active",
      priceId: BUSINESS_PRICE,
      clientReferenceId: TENANT_ID,
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.insertedEvents[0].tenant_id).toBe(TENANT_ID);
    expect(mockState.tenantUpdates[0].id).toBe(TENANT_ID);
    expect(mockState.tenantUpdates[0].patch.plan).toBe("business");
  });

  it("Case 9 — orphan event (no client_ref + no customer match) → tenant_id null, no update", async () => {
    // No mapping for the customer.
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "active",
      priceId: PRO_PRICE,
      customer: "cus_orphan_unknown",
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mockState.insertedEvents).toHaveLength(1);
    expect(mockState.insertedEvents[0].tenant_id).toBeNull();
    expect(mockState.tenantUpdates).toHaveLength(0);
  });

  it("Case 10 — unknown price ID → plan='free' (defensive default)", async () => {
    mockState.tenantsByStripeCustomer.set(CUSTOMER_ID, { id: TENANT_ID });
    const event = subscriptionEvent({
      type: "customer.subscription.created",
      status: "active",
      priceId: "price_typo_no_match",
    });
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    // Reconcile path STILL fires — patch.plan defaults to 'free'
    // when the price doesn't match either env var.
    expect(mockState.tenantUpdates[0].patch.plan).toBe("free");
  });
});
