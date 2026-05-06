// STORY-047 G6 — Twilio status callback receiver.
//
// Twilio POSTs application/x-www-form-urlencoded payloads here
// whenever a message changes state (queued → sent → delivered, or
// failed / undelivered). We update the matching `sms_messages` row
// by `twilio_sid` and stamp `delivered_at` on the terminal states.
//
// Auth model — single endpoint, two-stage verification:
//
//   Stage 1: parse the form body, pull `MessageSid` (the Twilio
//   message id) and `AccountSid` (the Twilio account that owns it).
//
//   Stage 2: look up our `sms_messages` row by `twilio_sid =
//   MessageSid`. From that row's `mode` + `tenant_id` we know which
//   credentials to verify against:
//     - mode='platform' → use the platform Twilio creds from
//                          Edge Function Secrets (process.env)
//     - mode='byok'     → join `tenant_sms_config` for the tenant's
//                          twilio_account_sid + twilio_auth_token
//
//   Stage 3: cross-check `AccountSid` (from body) against the stored
//   account SID for the row. Mismatch → 403 immediately, no HMAC
//   compute. Cheap forgery filter.
//
//   Stage 4: compute Twilio's HMAC-SHA1 over the canonicalised URL +
//   sorted form params, base64-encode, compare with `x-twilio-
//   signature` header using a timing-safe equality check. Mismatch
//   → 403.
//
// On valid signature: UPDATE the row's status, error_code, error_
// message, delivered_at. The UPDATE itself is idempotent — Twilio
// retries on non-2xx, and applying the same status twice is a no-op.
//
// On row-not-found by twilio_sid: return 200 anyway. Twilio retries
// otherwise pile up + we want them to stop trying. Logged as a
// warning so we notice if it happens often.
//
// DoS posture: one indexed lookup on `sms_messages.twilio_sid`
// (UNIQUE index) per request. Rate-limit at the Vercel edge if abuse
// appears.
//
// Multi-tenant signature host gotcha: Twilio computes its signature
// over the URL Twilio used to call us — `https://babun.app/api/twilio/status`.
// `x-forwarded-proto` + `host` give us the same value behind Vercel.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseService } from "@/lib/supabase/service";

// STORY-047 — supabase-js typed client is generated from
// @babun/shared/db/database.types which doesn't yet include the
// SMS tables (regen scheduled in a follow-up chore). Cast at the
// call sites so this route compiles in the meantime.
type TwilioSmsRow = {
  id: string;
  tenant_id: string;
  mode: "platform" | "byok";
};
type TwilioCfgRow = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
};

// Map Twilio's `MessageStatus` to our `sms_messages.status` enum.
// Anything we don't recognise becomes 'failed' so we have a row to
// inspect.
const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  sent: "sent",
  delivered: "delivered",
  failed: "failed",
  undelivered: "undelivered",
  // Intermediate states that don't trigger callbacks today but
  // that Twilio might add later:
  accepted: "queued",
  sending: "queued",
};

const TERMINAL_STATUSES = new Set(["delivered", "failed", "undelivered"]);

export async function POST(req: Request) {
  // ── Read raw body once. We need both the raw text (for HMAC) AND
  //    the parsed form data. Parsing it twice would consume the body
  //    stream, so do it from the captured string.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const params = new URLSearchParams(rawBody);

  const messageSid = params.get("MessageSid") ?? "";
  const accountSid = params.get("AccountSid") ?? "";
  const messageStatus = params.get("MessageStatus") ?? "";
  if (!messageSid || !accountSid || !messageStatus) {
    return NextResponse.json(
      { error: "missing MessageSid/AccountSid/MessageStatus" },
      { status: 400 },
    );
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 403 });
  }

  // STORY-078 hardening — verify HMAC FIRST against platform creds,
  // BEFORE the row lookup. Previous order returned 200 ignored on
  // unknown MessageSid which leaked an enumeration oracle (forger
  // could probe SIDs without ever passing signature). Now any caller
  // without a valid signature gets 403 regardless of whether we
  // know the SID. Legacy BYOK rows get re-verified with their own
  // creds further down — but the platform-creds gate is the cheap
  // first filter.
  const platformAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const platformAuthToken = process.env.TWILIO_AUTH_TOKEN;
  if (!platformAccountSid || !platformAuthToken) {
    // eslint-disable-next-line no-console
    console.error("twilio/status: platform creds missing in env");
    return NextResponse.json({ error: "platform creds missing" }, { status: 500 });
  }
  const fullUrl = computeFullUrl(req);
  const platformExpected = computeTwilioSignature(platformAuthToken, fullUrl, params);
  const platformSigOk =
    constantTimeStringEq(accountSid, platformAccountSid) &&
    constantTimeStringEq(platformExpected, signature);

  // For BYOK we'll re-verify after row lookup with per-tenant creds.
  // For platform-mode (the only mode in v3+) the verification is now
  // complete and any forgery is rejected before we touch the DB.
  if (!platformSigOk) {
    // We still don't know if this was a BYOK row — defer the 403 until
    // after the row lookup. But we MUST NOT return 200 ignored on
    // unknown SIDs anymore — fall through to lookup.
  }

  // ── Lookup our row + decide which auth_token to verify with ────
  // Cast through `any` because the generated DB types don't yet
  // include the SMS tables (chore: regenerate after STORY-047 lands).
  const supabase = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rowRaw, error: rowErr } = await sb
    .from("sms_messages")
    .select("id, tenant_id, mode")
    .eq("twilio_sid", messageSid)
    .maybeSingle();
  const row = rowRaw as TwilioSmsRow | null;
  if (rowErr) {
    // eslint-disable-next-line no-console
    console.error("twilio/status: row lookup failed", rowErr);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!row) {
    // STORY-078 — must verify signature even on unknown SID,
    // otherwise the response distinguishes "valid SID, sig OK" from
    // "any SID, no check" and acts as an enumeration oracle.
    if (!platformSigOk) {
      return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }
    // Signature was valid against platform creds but we don't have a
    // matching row — could be a stale retry of a wiped skeleton-mode
    // record. ACK so Twilio stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // STORY-078 — Row found. If platform-mode (modern path) the
  // signature is already verified against platform creds above; if
  // BYOK (legacy STORY-047 rows) re-verify with the tenant's own
  // creds.
  if (row.mode === "byok") {
    const { data: cfgRaw, error: cfgErr } = await sb
      .from("tenant_sms_config")
      .select("twilio_account_sid, twilio_auth_token")
      .eq("tenant_id", row.tenant_id)
      .maybeSingle();
    const cfg = cfgRaw as TwilioCfgRow | null;
    if (cfgErr || !cfg?.twilio_account_sid || !cfg?.twilio_auth_token) {
      // eslint-disable-next-line no-console
      console.error("twilio/status: BYOK creds missing", row.tenant_id, cfgErr);
      return NextResponse.json({ error: "byok creds missing" }, { status: 403 });
    }
    const byokExpected = computeTwilioSignature(cfg.twilio_auth_token, fullUrl, params);
    const byokSigOk =
      constantTimeStringEq(accountSid, cfg.twilio_account_sid) &&
      constantTimeStringEq(byokExpected, signature);
    if (!byokSigOk) {
      return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }
  } else {
    // platform-mode — sig already verified above with platform creds
    if (!platformSigOk) {
      return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }
  }

  // ── Apply update ───────────────────────────────────────────────
  const status = STATUS_MAP[messageStatus.toLowerCase()] ?? "failed";
  const errorCode = params.get("ErrorCode") || null;
  const errorMessage = params.get("ErrorMessage") || null;
  const deliveredAt = TERMINAL_STATUSES.has(status) ? new Date().toISOString() : null;

  const update: Record<string, unknown> = { status };
  if (errorCode) update.error_code = errorCode;
  if (errorMessage) update.error_message = errorMessage;
  if (deliveredAt) update.delivered_at = deliveredAt;

  const { error: updErr } = await sb
    .from("sms_messages")
    .update(update)
    .eq("twilio_sid", messageSid);
  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("twilio/status: update failed", updErr);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────────

function computeFullUrl(req: Request): string {
  // Twilio signs the URL it called us with — usually
  // https://babun.app/api/twilio/status. Behind Vercel we read
  // x-forwarded-proto + host because req.url's protocol can be
  // "http://" (internal hop).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "babun.app";
  const url = new URL(req.url);
  return `${proto}://${host}${url.pathname}${url.search}`;
}

function computeTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: URLSearchParams,
): string {
  // Sort form params by key, concatenate "key+value" pairs onto the URL.
  const keys: string[] = [];
  params.forEach((_v, k) => keys.push(k));
  keys.sort();
  let data = fullUrl;
  for (const k of keys) {
    data += k + (params.get(k) ?? "");
  }
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

function constantTimeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // timingSafeEqual requires equal-length Buffers. We've already
  // checked length, so this is safe.
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}
