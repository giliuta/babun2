// STORY-053b — send_push Edge Function (G1 SKELETON, do not deploy yet).
//
// Triggered by pg_net.http_post from Postgres triggers (G3) or by
// authenticated callers for testing. Reads push_subscriptions for the
// target user_ids, signs each notification with the VAPID private key
// from Supabase Vault, and sends via the standard Web Push protocol.
//
// G1 contract (this file): structure, types, Vault read, dependencies
// pinned. The actual `web-push` send + subscription pruning loop is
// stubbed and will land in G3 once the migration is reviewed and
// applied. No external network calls happen in this skeleton — calling
// it returns 200 with `{ sent: 0, skipped: <count>, mode: "skeleton" }`
// so we can exercise the end-to-end pg_net → http → 200 plumbing
// without sending real notifications during checkpoint review.
//
// Vault secrets read (set in G1 owner one-shots, before any G2 work):
//   VAPID_PUBLIC_KEY    — base64-url, also exposed in Vercel env as
//                          NEXT_PUBLIC_VAPID_PUBLIC_KEY for browsers
//   VAPID_PRIVATE_KEY   — base64-url, server-only
//   VAPID_SUBJECT       — "mailto:support@babun.app"
//
// CORS: this function is server-to-server (pg_net + maybe a debug UI in
// the dashboard). We allow any origin for testing now and tighten in G3
// to only allow the Supabase project URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

interface SendPushRequest {
  user_ids: string[];
  title: string;
  body: string;
  // Where the notification click should send the user. Resolved against
  // https://babun.app — relative paths only (e.g. "/dashboard/clients").
  url?: string;
  // Optional structured payload for the SW to inspect on click. Not
  // displayed to the user.
  data?: Record<string, unknown>;
}

interface SendPushResponse {
  sent: number;
  skipped: number;
  errors: Array<{ subscription_id: string; reason: string }>;
  mode: "skeleton" | "live";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function validate(body: unknown): SendPushRequest | string {
  if (typeof body !== "object" || body === null) return "invalid body";
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.user_ids) || b.user_ids.some((x) => typeof x !== "string")) {
    return "user_ids must be string[]";
  }
  if (typeof b.title !== "string" || b.title.length < 1 || b.title.length > 80) {
    return "title must be 1..80 chars";
  }
  if (typeof b.body !== "string" || b.body.length < 1 || b.body.length > 200) {
    return "body must be 1..200 chars";
  }
  if (b.url !== undefined && (typeof b.url !== "string" || !b.url.startsWith("/"))) {
    return "url must be a relative path starting with /";
  }
  return body as SendPushRequest;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method not allowed" });

  let parsed: SendPushRequest | string;
  try {
    parsed = validate(await req.json());
  } catch {
    return jsonResponse(400, { error: "invalid json" });
  }
  if (typeof parsed === "string") return jsonResponse(400, { error: parsed });
  const { user_ids, title, body, url, data: payloadData } = parsed;

  // Service-role client — bypasses RLS so we can read across users.
  // Supabase migrated from `SUPABASE_SERVICE_ROLE_KEY` (legacy, deprecated)
  // to `SUPABASE_SECRET_KEYS` (JSON dict of one or more keys issued via
  // JWT Signing Keys). The legacy var is still injected for backward compat
  // but on newer projects it lacks the privileges to bypass RLS, so prefer
  // the JSON dict and fall back only if it's empty.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let serviceKey: string | undefined;
  if (secretKeysJson) {
    try {
      const parsed = JSON.parse(secretKeysJson) as Record<string, string>;
      serviceKey = Object.values(parsed)[0];
    } catch {
      // fall through to legacy
    }
  }
  if (!serviceKey) serviceKey = legacyServiceKey || undefined;
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, {
      error: "missing SUPABASE_URL or service key (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY)",
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Edge Function Secrets — set in Dashboard → Edge Functions → Secrets
  // (NOT in Postgres Vault, those are different stores).
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse(500, {
      error:
        "missing VAPID secrets — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Edge Function Secrets",
    });
  }

  if (user_ids.length === 0) {
    return jsonResponse(200, {
      sent: 0,
      skipped: 0,
      errors: [],
      mode: "skeleton",
    } satisfies SendPushResponse);
  }

  // Fetch subscriptions but *don't* dispatch in the skeleton. This
  // proves the supabase + vault wiring without sending a single
  // notification during review.
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys, user_id")
    .in("user_id", user_ids);

  if (error) {
    return jsonResponse(500, { error: `fetch subscriptions: ${error.message}` });
  }

  // Build the payload that *would* be sent. Logged for trace; not posted.
  const _payload = JSON.stringify({
    title,
    body,
    url: url ?? "/dashboard",
    data: payloadData ?? {},
  });

  // G3 will replace this stub with the real web-push fan-out:
  //   for (const sub of subs) {
  //     const result = await webpush.sendNotification(
  //       { endpoint: sub.endpoint, keys: sub.keys },
  //       _payload,
  //       { vapidDetails: { subject: vapidSubject, publicKey, privateKey } }
  //     );
  //     if (result.statusCode === 410) {
  //       await supabase.from("push_subscriptions").delete().eq("id", sub.id);
  //     }
  //   }

  return jsonResponse(200, {
    sent: 0,
    skipped: subs?.length ?? 0,
    errors: [],
    mode: "skeleton",
  } satisfies SendPushResponse);
});
