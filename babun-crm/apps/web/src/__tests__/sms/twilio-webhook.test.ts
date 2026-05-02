// STORY-047 G6 — offline regression tests for /api/twilio/status.
//
// We can't hit a real Twilio account during CI, so this suite is the
// single source of truth that the webhook accepts valid signatures,
// rejects forgeries, and updates sms_messages correctly across the
// status mappings the route cares about.
//
// Strategy:
//   * Mock `getSupabaseService` with an in-memory client that records
//     calls to `from('table').select(...)` and `.update(...)`.
//   * Sign request bodies with the same HMAC algorithm the route
//     uses, so signatures match in the happy path tests.
//   * Hit the route's POST handler directly (no HTTP transport).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

// Module mock — must be hoisted before the route import.
const mockState: {
  smsRow: { id: string; tenant_id: string; mode: "platform" | "byok" } | null;
  cfgRow: {
    twilio_account_sid: string | null;
    twilio_auth_token: string | null;
  } | null;
  updates: Array<{ table: string; patch: Record<string, unknown>; sid: string }>;
  errors: { sms?: { message: string }; cfg?: { message: string } };
} = {
  smsRow: null,
  cfgRow: null,
  updates: [],
  errors: {},
};

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseService: () => ({
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                async maybeSingle() {
                  if (table === "sms_messages") {
                    return {
                      data: mockState.smsRow,
                      error: mockState.errors.sms ?? null,
                    };
                  }
                  if (table === "tenant_sms_config") {
                    return {
                      data: mockState.cfgRow,
                      error: mockState.errors.cfg ?? null,
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
              mockState.updates.push({ table, patch, sid: val });
              return { error: null };
            },
          };
        },
      };
    },
  }),
}));

// Pull the route in AFTER the mock is registered.
import { POST } from "@/app/api/twilio/status/route";

// Same HMAC algorithm as the route — used to sign happy-path bodies.
function signTwilio(
  authToken: string,
  fullUrl: string,
  params: URLSearchParams,
): string {
  const keys: string[] = [];
  params.forEach((_v, k) => keys.push(k));
  keys.sort();
  let data = fullUrl;
  for (const k of keys) data += k + (params.get(k) ?? "");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

const URL_HOST = "https://babun.app/api/twilio/status";

function makeReq(opts: {
  bodyParams: Record<string, string>;
  signature: string;
}): Request {
  const body = new URLSearchParams(opts.bodyParams).toString();
  return new Request("http://internal/api/twilio/status", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": opts.signature,
      "x-forwarded-proto": "https",
      "host": "babun.app",
    },
    body,
  });
}

// Standard fixture — valid platform-mode row + matching env creds.
const PLATFORM_ACCOUNT_SID = "ACplatform00000000000000000000test";
const PLATFORM_AUTH_TOKEN = "platform-auth-token-test-only";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TWILIO_SID = "SM00000000000000000000000000000001";

beforeEach(() => {
  mockState.smsRow = null;
  mockState.cfgRow = null;
  mockState.updates = [];
  mockState.errors = {};
  process.env.TWILIO_ACCOUNT_SID = PLATFORM_ACCOUNT_SID;
  process.env.TWILIO_AUTH_TOKEN = PLATFORM_AUTH_TOKEN;
});

function setPlatformRow() {
  mockState.smsRow = { id: "row-1", tenant_id: TENANT_ID, mode: "platform" };
}

describe("/api/twilio/status — happy path + status mapping", () => {
  it("Case 1 — valid signature + AccountSid + row → 200 + update fired", async () => {
    setPlatformRow();
    const params: Record<string, string> = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    const res = await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockState.updates).toHaveLength(1);
    expect(mockState.updates[0].table).toBe("sms_messages");
    expect(mockState.updates[0].sid).toBe(TWILIO_SID);
    expect(mockState.updates[0].patch.status).toBe("delivered");
  });

  it("Case 5 — 'delivered' sets delivered_at", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(typeof mockState.updates[0].patch.delivered_at).toBe("string");
  });

  it("Case 6 — 'sent' does NOT set delivered_at (intermediate state)", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "sent",
    };
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(mockState.updates[0].patch.status).toBe("sent");
    expect(mockState.updates[0].patch.delivered_at).toBeUndefined();
  });

  it("Case 7 — 'failed' + ErrorCode populates error fields + delivered_at", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "failed",
      ErrorCode: "30005",
      ErrorMessage: "Unknown destination",
    };
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(mockState.updates[0].patch.status).toBe("failed");
    expect(mockState.updates[0].patch.error_code).toBe("30005");
    expect(mockState.updates[0].patch.error_message).toBe("Unknown destination");
    expect(typeof mockState.updates[0].patch.delivered_at).toBe("string");
  });
});

describe("/api/twilio/status — security gates", () => {
  it("Case 2 — valid signature + WRONG AccountSid → 403, no update", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: "ACforger0000000000000000000000bad",
      MessageStatus: "delivered",
    };
    // Sign anyway — but the AccountSid cross-check fires before HMAC.
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    const res = await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(res.status).toBe(403);
    expect(mockState.updates).toHaveLength(0);
  });

  it("Case 3 — WRONG signature + valid AccountSid → 403, no update", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    // Compute signature with the WRONG token so HMAC fails.
    const sig = signTwilio(
      "wrong-token",
      URL_HOST,
      new URLSearchParams(params),
    );
    const res = await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(res.status).toBe(403);
    expect(mockState.updates).toHaveLength(0);
  });

  it("Case 4 — non-existent MessageSid → 200 ignored, no update", async () => {
    // smsRow stays null in beforeEach.
    const params = {
      MessageSid: "SMnonexistent00000000000000000000",
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    // Signature doesn't matter here — we never reach HMAC because
    // the lookup returns null first.
    const sig = signTwilio(
      PLATFORM_AUTH_TOKEN,
      URL_HOST,
      new URLSearchParams(params),
    );
    const res = await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, ignored: true });
    expect(mockState.updates).toHaveLength(0);
  });
});

describe("/api/twilio/status — input validation", () => {
  it("missing MessageSid → 400", async () => {
    const params = {
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    const sig = "ignored";
    const res = await POST(makeReq({ bodyParams: params, signature: sig }));
    expect(res.status).toBe(400);
  });

  it("missing x-twilio-signature header → 403", async () => {
    setPlatformRow();
    const params = {
      MessageSid: TWILIO_SID,
      AccountSid: PLATFORM_ACCOUNT_SID,
      MessageStatus: "delivered",
    };
    const body = new URLSearchParams(params).toString();
    const req = new Request("http://internal/api/twilio/status", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-proto": "https",
        "host": "babun.app",
      },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
