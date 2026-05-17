// Brief 2 #26 — Webcal / iCalendar feed at /api/calendar/<user_id>.ics
//
// Subscribable URL that returns an .ics document with every active
// appointment for the given user's tenant. Apple Calendar / Google
// Calendar / Outlook / Thunderbird can subscribe and refresh on
// their own schedule. The endpoint is unauthenticated by design —
// the URL itself is the secret (matches the Bumpix / Calendly /
// most-calendar-app pattern). To revoke access, rotate the user id
// or expose a separate per-tenant calendar_token field later.
//
// Scope of this MVP:
//   · Public read of confirmed appointments for the tenant the user
//     belongs to (look up via tenant_members).
//   · Cancelled appointments excluded so reader calendars don't show
//     ghost entries.
//   · No recurrence expansion — `event_repeat` is currently stored
//     but not expanded anywhere in the app (see Brief 2 #18 note).
//     Recurring entries appear once at their first occurrence.
//   · 6-month window: from 30 days ago to 180 days ahead so the
//     payload stays bounded and old visits don't clutter the feed.

import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase/service";
import { listAppointments } from "@babun/shared/db/repositories/appointments";
import type { Appointment } from "@babun/shared/local/appointments";

interface RouteParams {
  params: Promise<{ user_id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: RouteParams) {
  const { user_id: raw } = await ctx.params;
  // Strip the .ics suffix Apple / Google add when subscribing.
  const id = raw.replace(/\.ics$/i, "");
  if (!UUID_RE.test(id)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const sb = getSupabaseService();
  // Find the tenant this user belongs to. service-role bypasses RLS
  // by design — this endpoint is the user's own subscription URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (sb as any)
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", id)
    .maybeSingle();
  if (!member?.tenant_id) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apts = await listAppointments(sb as any, member.tenant_id);

  // Window: 30 days back ... 180 days ahead.
  const now = new Date();
  const back = new Date(now);
  back.setDate(back.getDate() - 30);
  const ahead = new Date(now);
  ahead.setDate(ahead.getDate() + 180);
  const startKey = ymd(back);
  const endKey = ymd(ahead);

  const visible = apts.filter(
    (a) =>
      a.status !== "cancelled" &&
      a.date >= startKey &&
      a.date <= endKey,
  );

  const body = buildIcs(visible, id);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Content-Disposition": `inline; filename=babun-${id}.ics`,
    },
  });
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildIcs(apts: Appointment[], userId: string): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Babun CRM//Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:Babun (${userId.slice(0, 8)})`);
  lines.push("X-WR-TIMEZONE:Europe/Nicosia");

  for (const apt of apts) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${apt.id}@babun.app`);
    lines.push(`DTSTAMP:${stampNow()}`);
    lines.push(`DTSTART:${stamp(apt.date, apt.time_start)}`);
    lines.push(`DTEND:${stamp(apt.date, apt.time_end)}`);
    lines.push(`SUMMARY:${escapeIcs(summarize(apt))}`);
    if (apt.address) lines.push(`LOCATION:${escapeIcs(apt.address)}`);
    if (apt.comment)
      lines.push(`DESCRIPTION:${escapeIcs(apt.comment)}`);
    lines.push(`STATUS:${apt.status === "completed" ? "CONFIRMED" : "TENTATIVE"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // CRLF per RFC 5545.
  return lines.join("\r\n") + "\r\n";
}

function summarize(apt: Appointment): string {
  if (apt.kind === "event" || apt.kind === "personal") {
    return apt.comment || "Событие";
  }
  return apt.comment || "Запись";
}

// "YYYYMMDDTHHmmss" — floating local time (no Z suffix) so consumer
// calendars interpret in their own zone. For strict UTC export later
// we'd need to materialize the tenant's timezone and convert here.
function stamp(dateKey: string, hhmm: string): string {
  const d = dateKey.replace(/-/g, "");
  const t = hhmm.replace(":", "") + "00";
  return `${d}T${t}`;
}

function stampNow(): string {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") +
    "T" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    String(d.getUTCSeconds()).padStart(2, "0") +
    "Z"
  );
}

// RFC 5545: backslash-escape comma, semicolon, backslash; replace
// newlines with \\n. Keep payload single-line per property; we'd
// also need to fold lines > 75 octets but most clients tolerate
// longer lines and this MVP keeps the implementation small.
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
