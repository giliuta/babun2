// STORY-069 wave 3 — send_sms Edge Function (LIVE).
//
// Driven by pg_cron every 5 minutes. Sweeps appointments that need a
// 24h or 2h reminder and sends them via the platform's single Twilio
// account. The per-tenant BYOK model from STORY-047 is dropped.
//
// Send mechanics:
//   * sender = tenant_sms_config.sender_name when sender_status='approved',
//     else PLATFORM_DEFAULT_SENDER ("Babun"). Cyprus (Babun's first
//     country) doesn't require Alpha Sender registration, so the
//     fallback works without paperwork.
//   * cost = PER_SMS_COST_CENTS per send. Free trial slots
//     (free_sms_remaining) consumed first, then balance_cents.
//     Tenant blocked when both are exhausted.
//
// Idempotency: sms_messages has a partial UNIQUE on
// (appointment_id, trigger_type) so a retried cron firing can't
// double-send. The pre-check is just a counter optimisation.
//
// Time window: ±5 min around T-24h / T-2h. Tenant TZ assumed
// Europe/Nicosia (single-TZ v1).
//
// Master switch: app_settings.sms_enabled = 'on' required. Off →
// the function returns immediately without scanning.
//
// Dual-write: every send inserts into sms_messages (legacy — the
// Twilio status webhook + Settings/Billing UI still read from it)
// AND sms_logs (new — /admin dashboards + STORY-069 SMS history UI).
// Both rows share the Twilio MessageSid for cross-table joins.
//
// CORS: server-to-server only (pg_cron via pg_net). Open for now.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

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

// ─── Pricing / sender constants ──────────────────────────────────
// Mirror the values in src/app/dashboard/settings/sms/sms-constants.ts.
// Edge runtime can't import from the Next app, so keep them in sync
// by hand — both locations comment-link this duplication.
const PER_SMS_COST_CENTS = 10;
const PLATFORM_DEFAULT_SENDER = "Babun";

// ─── Types ────────────────────────────────────────────────────────

type TriggerType = "reminder_24h" | "reminder_2h" | "manual" | "test";

interface TenantSmsConfig {
  tenant_id: string;
  enabled: boolean;
  remind_24h_before: boolean;
  remind_2h_before: boolean;
  template_24h: string;
  template_2h: string;
  sender_name: string | null;
  sender_status: "pending" | "approved" | "rejected" | null;
  balance_cents: number;
  free_sms_remaining: number;
  total_sent_count: number;
  // Legacy mode/quota fields are still on the row but unused in v3.
  mode: "platform" | "byok";
}

interface AppointmentRow {
  id: string;
  tenant_id: string;
  client_id: string | null;
  date: string;
  time_start: string;
}

interface ClientRow {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface TenantRow {
  id: string;
  name: string;
}

interface SendSmsResponse {
  matched: number;
  sent: number;
  blocked: number;
  skipped: number;
  failed: number;
  errors: Array<{ tenant_id: string; appointment_id?: string; reason: string }>;
}

// ─── Supabase + Twilio bootstrap ─────────────────────────────────

function buildServiceClient(): ReturnType<typeof createClient> | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let serviceKey: string | undefined;
  if (secretKeysJson) {
    try {
      const dict = JSON.parse(secretKeysJson) as Record<string, string>;
      serviceKey = Object.values(dict)[0];
    } catch {
      /* fall through */
    }
  }
  if (!serviceKey) serviceKey = legacyServiceKey || undefined;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface TwilioCreds {
  accountSid: string;
  authToken: string;
  // Optional: status callback URL Twilio POSTs delivery updates to.
  // Falls back to the public default when unset.
  statusCallbackUrl: string | null;
}

function readTwilioCreds(): TwilioCreds | null {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return null;
  const statusCallbackUrl =
    Deno.env.get("TWILIO_STATUS_CALLBACK_URL") ?? "https://babun.app/api/twilio/status";
  return { accountSid, authToken, statusCallbackUrl };
}

// ─── Twilio call ─────────────────────────────────────────────────
//
// Uses the form-encoded REST endpoint directly. Avoids a Twilio SDK
// in the Deno runtime — keeps the function lean and there's no SDK
// shim we'd need anyway.
interface TwilioSendResult {
  ok: true;
  sid: string;
  status: string;
}
interface TwilioSendError {
  ok: false;
  status: string | null;
  errorCode: string | null;
  errorMessage: string;
}

async function twilioSend(
  creds: TwilioCreds,
  from: string,
  to: string,
  body: string,
): Promise<TwilioSendResult | TwilioSendError> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  const auth = btoa(`${creds.accountSid}:${creds.authToken}`);

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);
  if (creds.statusCallbackUrl) form.set("StatusCallback", creds.statusCallbackUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      status: null,
      errorCode: "network_error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    /* ignore — error path below handles missing body */
  }

  if (!res.ok) {
    return {
      ok: false,
      status: typeof payload.status === "string" ? payload.status : null,
      errorCode:
        typeof payload.code === "number" || typeof payload.code === "string"
          ? String(payload.code)
          : `http_${res.status}`,
      errorMessage:
        typeof payload.message === "string" ? payload.message : `Twilio HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    sid: String(payload.sid ?? ""),
    status: typeof payload.status === "string" ? payload.status : "queued",
  };
}

// ─── Time helpers ─────────────────────────────────────────────────

const TENANT_TZ = "Europe/Nicosia";
const WINDOW_MINUTES = 5;

function tenantLocalToUtc(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const naive = new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(t[1]),
      Number(t[2]),
      0,
      0,
    ),
  );
  const tzFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TENANT_TZ,
    timeZoneName: "shortOffset",
  });
  const offsetPart = tzFmt
    .formatToParts(naive)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const off = /GMT([+-]\d+)/.exec(offsetPart)?.[1] ?? "+0";
  const offsetHours = Number(off);
  return new Date(naive.getTime() - offsetHours * 3600_000);
}

function isWithinWindow(target: Date, center: Date, mins: number): boolean {
  return Math.abs(target.getTime() - center.getTime()) <= mins * 60_000;
}

function formatDateRu(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${day} ${months[month] ?? ""}`.trim();
}

function renderTemplate(
  template: string,
  ctx: {
    client_name: string;
    time: string;
    date: string;
    phone: string;
    business_name: string;
  },
): string {
  return template
    .replaceAll("{client_name}", ctx.client_name)
    .replaceAll("{time}", ctx.time)
    .replaceAll("{date}", ctx.date)
    .replaceAll("{phone}", ctx.phone)
    .replaceAll("{business_name}", ctx.business_name);
}

function isoDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TENANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

// Resolve which sender name to use + whether this send eats a free
// slot or balance. Returns null when the tenant is fully blocked.
function planSend(
  cfg: TenantSmsConfig,
): {
  senderName: string;
  charge: "free" | "paid";
  costCents: number;
} | { blocked: "no_credit" } {
  const senderName =
    cfg.sender_status === "approved" && cfg.sender_name
      ? cfg.sender_name
      : PLATFORM_DEFAULT_SENDER;

  if (cfg.free_sms_remaining > 0) {
    return { senderName, charge: "free", costCents: 0 };
  }
  if (cfg.balance_cents >= PER_SMS_COST_CENTS) {
    return { senderName, charge: "paid", costCents: PER_SMS_COST_CENTS };
  }
  return { blocked: "no_credit" };
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  const supabase = buildServiceClient();
  if (!supabase) {
    return jsonResponse(500, { error: "service-role client unavailable" });
  }

  // ── Master switch ────────────────────────────────────────────
  const { data: flagRow, error: flagErr } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "sms_enabled")
    .maybeSingle();
  if (flagErr) {
    return jsonResponse(500, { error: `app_settings: ${flagErr.message}` });
  }
  if (!flagRow || flagRow.value !== "on") {
    return jsonResponse(200, {
      matched: 0,
      sent: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      reason: "sms_enabled_off",
    } satisfies SendSmsResponse & { reason: string });
  }

  const twilio = readTwilioCreds();
  if (!twilio) {
    return jsonResponse(503, {
      error: "twilio_not_configured",
      hint: "Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN in Edge Function Secrets.",
    });
  }

  // ── Sweep enabled tenants ────────────────────────────────────
  const { data: configs, error: cfgErr } = await supabase
    .from("tenant_sms_config")
    .select("*")
    .eq("enabled", true);
  if (cfgErr) {
    return jsonResponse(500, { error: `tenant_sms_config: ${cfgErr.message}` });
  }

  const now = new Date();
  const t24 = new Date(now.getTime() + 24 * 60 * 60_000);
  const t02 = new Date(now.getTime() + 2 * 60 * 60_000);

  const out: SendSmsResponse = {
    matched: 0,
    sent: 0,
    blocked: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const cfgRaw of (configs ?? []) as TenantSmsConfig[]) {
    // Mutable in-loop copy so deductions stay consistent across the
    // tenant's batch before we persist at the end.
    const cfg = { ...cfgRaw };
    try {
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .select("id,name")
        .eq("id", cfg.tenant_id)
        .single();
      if (tenantErr || !tenant) {
        out.errors.push({
          tenant_id: cfg.tenant_id,
          reason: `tenant lookup: ${tenantErr?.message ?? "not found"}`,
        });
        continue;
      }

      const todayStr = isoDate(now);
      const tomorrowStr = isoDate(new Date(now.getTime() + 25 * 60 * 60_000));
      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("id,tenant_id,client_id,date,time_start")
        .eq("tenant_id", cfg.tenant_id)
        .eq("status", "scheduled")
        .in("date", [todayStr, tomorrowStr]);
      if (apptErr) {
        out.errors.push({
          tenant_id: cfg.tenant_id,
          reason: `appointments: ${apptErr.message}`,
        });
        continue;
      }

      for (const apt of (appts ?? []) as AppointmentRow[]) {
        const startUtc = tenantLocalToUtc(apt.date, apt.time_start);
        if (!startUtc) continue;

        let trigger: TriggerType | null = null;
        if (cfg.remind_24h_before && isWithinWindow(startUtc, t24, WINDOW_MINUTES)) {
          trigger = "reminder_24h";
        } else if (
          cfg.remind_2h_before &&
          isWithinWindow(startUtc, t02, WINDOW_MINUTES)
        ) {
          trigger = "reminder_2h";
        }
        if (!trigger) continue;

        out.matched++;

        // Idempotency pre-check on sms_messages legacy table —
        // partial UNIQUE on (appointment_id, trigger_type).
        const { data: existing } = await supabase
          .from("sms_messages")
          .select("id")
          .eq("appointment_id", apt.id)
          .eq("trigger_type", trigger)
          .maybeSingle();
        if (existing) {
          out.skipped++;
          continue;
        }

        // Recipient + body.
        let client: ClientRow | null = null;
        if (apt.client_id) {
          const { data: c } = await supabase
            .from("clients")
            .select("id,full_name,phone")
            .eq("id", apt.client_id)
            .maybeSingle();
          client = (c as ClientRow | null) ?? null;
        }
        const toPhone = client?.phone ?? "";
        if (!toPhone) {
          out.errors.push({
            tenant_id: cfg.tenant_id,
            appointment_id: apt.id,
            reason: "client phone missing",
          });
          continue;
        }

        const templateRaw =
          trigger === "reminder_24h" ? cfg.template_24h : cfg.template_2h;
        const body = renderTemplate(templateRaw, {
          client_name: client?.full_name ?? "клиент",
          time: apt.time_start,
          date: formatDateRu(apt.date),
          phone: toPhone,
          business_name: (tenant as TenantRow).name ?? "",
        });

        // Pricing decision BEFORE Twilio call. Block tenants without
        // credit instead of failing mid-fanout.
        const plan = planSend(cfg);
        if ("blocked" in plan) {
          await supabase.from("sms_messages").insert({
            tenant_id: cfg.tenant_id,
            appointment_id: apt.id,
            client_id: client?.id ?? null,
            to_phone: toPhone,
            message_body: body,
            status: "failed",
            error_code: "no_credit",
            error_message:
              "Бесплатные SMS закончились, баланс < стоимости отправки",
            trigger_type: trigger,
            mode: "platform",
          });
          await supabase.from("sms_logs").insert({
            tenant_id: cfg.tenant_id,
            to_phone: toPhone,
            body,
            sender_name_used: PLATFORM_DEFAULT_SENDER,
            cost_cents: 0,
            was_free: false,
            error_code: "no_credit",
            error_message: "no_credit",
            appointment_id: apt.id,
          });
          out.blocked++;
          continue;
        }

        // Send to Twilio.
        const result = await twilioSend(twilio, plan.senderName, toPhone, body);

        if (!result.ok) {
          await supabase.from("sms_messages").insert({
            tenant_id: cfg.tenant_id,
            appointment_id: apt.id,
            client_id: client?.id ?? null,
            to_phone: toPhone,
            message_body: body,
            status: "failed",
            error_code: result.errorCode,
            error_message: result.errorMessage,
            trigger_type: trigger,
            mode: "platform",
          });
          await supabase.from("sms_logs").insert({
            tenant_id: cfg.tenant_id,
            to_phone: toPhone,
            body,
            sender_name_used: plan.senderName,
            cost_cents: 0,
            was_free: plan.charge === "free",
            twilio_status: result.status ?? "failed",
            error_code: result.errorCode,
            error_message: result.errorMessage,
            appointment_id: apt.id,
          });
          out.failed++;
          continue;
        }

        // Success — write sms_messages (legacy) + sms_logs (new) +
        // deduct from local cfg copy. Persist counters at end of
        // tenant loop to save round-trips.
        await supabase.from("sms_messages").insert({
          tenant_id: cfg.tenant_id,
          appointment_id: apt.id,
          client_id: client?.id ?? null,
          to_phone: toPhone,
          message_body: body,
          status: "sent",
          twilio_sid: result.sid,
          trigger_type: trigger,
          mode: "platform",
          sent_at: new Date().toISOString(),
        });
        await supabase.from("sms_logs").insert({
          tenant_id: cfg.tenant_id,
          to_phone: toPhone,
          body,
          sender_name_used: plan.senderName,
          cost_cents: plan.costCents,
          was_free: plan.charge === "free",
          twilio_message_sid: result.sid,
          twilio_status: result.status,
          appointment_id: apt.id,
        });

        if (plan.charge === "free") {
          cfg.free_sms_remaining = Math.max(0, cfg.free_sms_remaining - 1);
        } else {
          cfg.balance_cents = Math.max(0, cfg.balance_cents - plan.costCents);
        }
        cfg.total_sent_count = (cfg.total_sent_count ?? 0) + 1;
        out.sent++;
      }

      // Persist tenant counters once per cron pass per tenant.
      if (
        cfg.free_sms_remaining !== cfgRaw.free_sms_remaining ||
        cfg.balance_cents !== cfgRaw.balance_cents ||
        cfg.total_sent_count !== cfgRaw.total_sent_count
      ) {
        await supabase
          .from("tenant_sms_config")
          .update({
            free_sms_remaining: cfg.free_sms_remaining,
            balance_cents: cfg.balance_cents,
            total_sent_count: cfg.total_sent_count,
          })
          .eq("tenant_id", cfg.tenant_id);
      }
    } catch (err) {
      out.errors.push({
        tenant_id: cfg.tenant_id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse(200, out);
});
