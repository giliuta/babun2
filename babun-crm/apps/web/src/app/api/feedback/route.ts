// STORY-060 §F3.5 — bug-report endpoint.
//
// Accepts POST with the BugReportButton payload. When GITHUB_TOKEN is
// set in the runtime env, opens a GitHub Issue on `giliuta/babun2`.
// Otherwise logs the payload server-side and returns ok — safe
// fallback for dev.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface FeedbackPayload {
  email?: string;
  message: string;
  version: string;
  url: string;
  user_agent: string;
  viewport: { w: number; h: number };
  console_errors?: string[];
}

function isValidPayload(value: unknown): value is FeedbackPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.message !== "string") return false;
  if (typeof v.version !== "string") return false;
  if (typeof v.url !== "string") return false;
  if (typeof v.user_agent !== "string") return false;
  if (!v.viewport || typeof v.viewport !== "object") return false;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "MESSAGE_REQUIRED" }, { status: 400 });
  }

  const trimmed = payload.message.trim();
  if (trimmed.length === 0 || trimmed.length > 4000) {
    return NextResponse.json({ error: "MESSAGE_REQUIRED" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // Dev / no-token fallback. Print so it lands in Vercel logs.
    console.error("[bug-report]", JSON.stringify(payload));
    return NextResponse.json({ ok: true, channel: "log" });
  }

  try {
    const title = `[bug] ${trimmed.slice(0, 80)}`;
    const body = [
      payload.email ? `**Reporter:** ${payload.email}` : null,
      `**Version:** ${payload.version}`,
      `**URL:** ${payload.url}`,
      `**Viewport:** ${payload.viewport.w}×${payload.viewport.h}`,
      `**User-Agent:** \`${payload.user_agent}\``,
      "",
      "**Message:**",
      "",
      trimmed,
      payload.console_errors && payload.console_errors.length > 0
        ? "\n**Recent console.error:**\n```\n" +
          payload.console_errors.join("\n") +
          "\n```"
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const ghRes = await fetch(
      "https://api.github.com/repos/giliuta/babun2/issues",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          labels: ["bug-report", "user-feedback"],
        }),
      },
    );
    if (!ghRes.ok) {
      const detail = await ghRes.text();
      console.error("[bug-report] github error", ghRes.status, detail);
      return NextResponse.json(
        { ok: false, error: "UPSTREAM_FAILED" },
        { status: 502 },
      );
    }
    const issue = (await ghRes.json()) as { html_url?: string };
    return NextResponse.json({
      ok: true,
      channel: "github",
      issue_url: issue.html_url,
    });
  } catch (err) {
    console.error("[bug-report] exception", err);
    return NextResponse.json(
      { ok: false, error: "UPSTREAM_FAILED" },
      { status: 502 },
    );
  }
}
