// STORY-047 G3 — send_sms Edge Function (SKELETON MODE).
//
// Triggered by pg_cron every 5 minutes (G4 sets up the schedule). The
// function sweeps appointments that need a 24h or 2h reminder, renders
// the tenant's template, applies quota / mode rules, and inserts an
// `sms_messages` row per appointment + trigger pairing.
//
// SKELETON: this version does NOT call Twilio. Rows are inserted with
// `status='queued'` and `error_message='[skeleton] Twilio not yet wired'`
// so the cron + query + render path can be smoke-tested before real
// creds + fan-out land in G3b. The G3b diff will:
//   - drop the [skeleton] marker
//   - replace the early-return with the real Twilio Messages.create()
//     call
//   - update status to 'sent' (or 'failed' on Twilio error)
//   - record `twilio_sid`
//
// Master switch: `app_settings.sms_enabled = 'on'` is required for ANY
// row to be inserted. Off → function logs + returns immediately. Same
// pattern as STORY-053b push_enabled. Pipeline ships inert.
//
// Idempotency: per (appointment_id, trigger_type) the table has a
// partial UNIQUE index. The query below LEFT-JOINs against
// sms_messages to skip appointments that already have a reminder
// row, so a cron retry can't double-fire.
//
// Time window: appointment.date is text "YYYY-MM-DD" and time_start
// is text "HH:MM". v1 assumes Europe/Nicosia for every tenant
// (single-TZ assumption locked in calendar_settings). When
// multi-tenant timezones land, this function reads the per-tenant
// TZ from calendar_settings and computes the local timestamp.
//
// Quota (Platform mode + Free tier): each tenant's
// `sent_this_month` + `free_quota_per_month` are checked before a
// would-be Twilio call. Self-resets via `quota_period_start` when
// the calendar month rolls over — no janitor cron required.
//
// CORS: server-to-server only (pg_cron via pg_net). Open for now;
// tighten if abuse appears.

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

// ─── Types ────────────────────────────────────────────────────────

type TriggerType = "reminder_24h" | "reminder_2h" | "manual" | "test";
type Mode = "platform" | "byok";

interface TenantSmsConfig {
  tenant_id: string;
  mode: Mode;
  enabled: boolean;
  remind_24h_before: boolean;
  remind_2h_before: boolean;
  template_24h: string;
  template_2h: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  sent_this_month: number;
  free_quota_per_month: number;
  quota_period_start: string; // ISO timestamp
}

interface AppointmentRow {
  id: string;
  tenant_id: string;
  client_id: string | null;
  date: string;       // YYYY-MM-DD
  time_start: string; // HH:MM
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
  queued: number;
  blocked: number;
  skipped: number;
  errors: Array<{ tenant_id: string; appointment_id?: string; reason: string }>;
  mode: "skeleton" | "live";
}

// ─── Service-role client (legacy + JWT-Signing-Keys both supported) ─

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

// ─── Time helpers ─────────────────────────────────────────────────

const TENANT_TZ = "Europe/Nicosia"; // v1 single-TZ assumption
const WINDOW_MINUTES = 5;           // ±5 min window per cron fire

/** Build a UTC Date from a tenant-local "YYYY-MM-DD" + "HH:MM" pair.
 *  Europe/Nicosia (EET / EEST) — uses the JS Intl machinery to find
 *  the correct UTC offset for that wall-clock date so DST flips are
 *  handled without our own table. Returns null on parse error. */
function tenantLocalToUtc(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  // Construct a Date as if the wall-clock time were UTC, then ask
  // the Intl formatter what offset Europe/Nicosia would have at
  // that instant, and subtract.
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
  // getTimezoneOffset for Europe/Nicosia at `naive`:
  const tzFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TENANT_TZ,
    timeZoneName: "shortOffset",
  });
  const offsetPart = tzFmt
    .formatToParts(naive)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  // shortOffset gives "GMT+2" / "GMT+3"; strip and parse.
  const off = /GMT([+-]\d+)/.exec(offsetPart)?.[1] ?? "+0";
  const offsetHours = Number(off);
  return new Date(naive.getTime() - offsetHours * 3600_000);
}

function isWithinWindow(target: Date, center: Date, mins: number): boolean {
  return Math.abs(target.getTime() - center.getTime()) <= mins * 60_000;
}

function formatDateRu(date: string): string {
  // "5 мая" — short RU display in templates.
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

// ─── Template rendering ───────────────────────────────────────────

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

// ─── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  const supabase = buildServiceClient();
  if (!supabase) {
    return jsonResponse(500, { error: "service-role client unavailable" });
  }

  // ── Master switch ──────────────────────────────────────────────
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
      queued: 0,
      blocked: 0,
      skipped: 0,
      errors: [],
      mode: "skeleton",
      reason: "sms_enabled_off",
    } satisfies SendSmsResponse & { reason: string });
  }

  // ── Sweep enabled tenants ──────────────────────────────────────
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
    queued: 0,
    blocked: 0,
    skipped: 0,
    errors: [],
    mode: "skeleton",
  };

  for (const cfg of (configs ?? []) as TenantSmsConfig[]) {
    try {
      // Tenant name for {business_name}
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

      // Quota self-reset (platform-mode only — BYOK tenants don't
      // hit our quota tracking). Compare current month's start
      // against quota_period_start; reset if a month has elapsed.
      let sentThisMonth = cfg.sent_this_month;
      let quotaStart = new Date(cfg.quota_period_start);
      const currentMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      if (cfg.mode === "platform" && currentMonthStart > quotaStart) {
        sentThisMonth = 0;
        quotaStart = currentMonthStart;
        await supabase
          .from("tenant_sms_config")
          .update({
            sent_this_month: 0,
            quota_period_start: quotaStart.toISOString(),
          })
          .eq("tenant_id", cfg.tenant_id);
      }

      // Query candidate appointments for this tenant. We cast a wide
      // net (next 25h to cover both 24h and 2h windows + slack) and
      // filter precisely in JS — keeps the SQL simple at the cost of
      // a slight over-fetch. With 1000 tenants × ~50 appointments/day
      // that's ≤50000 rows in memory during one cron pass, which is
      // fine; rewrite with per-row date arithmetic if it ever bites.
      const todayStr = isoDate(now);
      const tomorrowStr = isoDate(new Date(now.getTime() + 25 * 60 * 60_000));
      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("id,tenant_id,client_id,date,time_start")
        .eq("tenant_id", cfg.tenant_id)
        // Strictly `scheduled` — sending a 2h reminder for an
        // already-in-progress visit confuses the client (the master
        // is on site / on the phone with them already).
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

        // Decide which trigger (if any) this appointment matches.
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

        // Idempotency check — skip if a row already exists for this
        // (appointment, trigger). The partial UNIQUE index in G1
        // would also reject the INSERT, but checking first lets us
        // categorize correctly in the response counters.
        const { data: existing, error: existErr } = await supabase
          .from("sms_messages")
          .select("id")
          .eq("appointment_id", apt.id)
          .eq("trigger_type", trigger)
          .maybeSingle();
        if (existErr) {
          out.errors.push({
            tenant_id: cfg.tenant_id,
            appointment_id: apt.id,
            reason: `idempotency: ${existErr.message}`,
          });
          continue;
        }
        if (existing) {
          out.skipped++;
          continue;
        }

        // Resolve client + tenant data for template placeholders.
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

        // Quota gate (platform mode). BYOK tenants pay Twilio
        // directly — we don't track their usage.
        if (
          cfg.mode === "platform" &&
          sentThisMonth >= cfg.free_quota_per_month
        ) {
          const { error: quotaInsErr } = await supabase
            .from("sms_messages")
            .insert({
              tenant_id: cfg.tenant_id,
              appointment_id: apt.id,
              client_id: client?.id ?? null,
              to_phone: toPhone,
              message_body: body,
              status: "failed",
              error_code: "quota_exceeded",
              error_message: `Платформа: ${cfg.free_quota_per_month} SMS / месяц израсходовано`,
              trigger_type: trigger,
              mode: cfg.mode,
            });
          if (quotaInsErr) {
            // Same 23505 race protection as the skeleton insert below.
            if ((quotaInsErr as { code?: string }).code === "23505") {
              out.skipped++;
            } else {
              out.errors.push({
                tenant_id: cfg.tenant_id,
                appointment_id: apt.id,
                reason: `quota insert: ${quotaInsErr.message}`,
              });
            }
            continue;
          }
          out.blocked++;
          continue;
        }

        // ── SKELETON: insert with status='failed' + error_code
        // 'skeleton_mode'. NOT 'queued' — that status means "in
        // flight to Twilio", and skeleton mode never attempts the
        // call. Cleanup pattern: DELETE WHERE error_code = 'skeleton_mode'.
        // G3b will replace this block with the real Twilio call +
        // status='sent'/'failed' + twilio_sid.
        const { error: insErr } = await supabase.from("sms_messages").insert({
          tenant_id: cfg.tenant_id,
          appointment_id: apt.id,
          client_id: client?.id ?? null,
          to_phone: toPhone,
          message_body: body,
          status: "failed",
          error_code: "skeleton_mode",
          error_message: "[skeleton] Twilio not yet wired",
          trigger_type: trigger,
          mode: cfg.mode,
        });
        if (insErr) {
          // 23505 = unique_violation. Defense-in-depth: the partial
          // UNIQUE on (appointment_id, trigger_type) catches the
          // (extremely unlikely) race between our pre-check and this
          // INSERT — pg_cron is single-flight per tag so it shouldn't
          // happen, but a manual `cron.dispatch()` fired in parallel
          // with the scheduled run could trigger it. Treat as skipped
          // rather than killing the rest of the loop.
          if ((insErr as { code?: string }).code === "23505") {
            out.skipped++;
          } else {
            out.errors.push({
              tenant_id: cfg.tenant_id,
              appointment_id: apt.id,
              reason: `insert: ${insErr.message}`,
            });
          }
          continue;
        }

        out.queued++;
        if (cfg.mode === "platform") {
          sentThisMonth++;
          // Increment in-place so the quota gate sees the new total
          // before deciding the next loop iteration. DB write is
          // batched at end of the tenant loop to save round-trips.
        }
      }

      // Persist the bumped counter (platform mode only).
      if (cfg.mode === "platform" && sentThisMonth !== cfg.sent_this_month) {
        await supabase
          .from("tenant_sms_config")
          .update({ sent_this_month: sentThisMonth })
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

function isoDate(d: Date): string {
  // YYYY-MM-DD in tenant TZ — used to filter appointments.date.
  // Matches the `text` column shape the app stores.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TENANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}
