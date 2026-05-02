"use client";

// STORY-053b — one-time "Включить уведомления?" modal.
//
// Visibility rules (computed once on mount, never toggled mid-session):
//   1. SW + Push API present (canSubscribePush from detectPlatform).
//   2. iOS users must already be in a home-screen-installed PWA — plain
//      Safari can't subscribe.
//   3. babun-session-count >= 2 (we count successful DashboardClientLayout
//      mounts; new users see this on their second session, not their first).
//   4. babun-push-prompt-dismissed-at is missing OR > 7 days ago.
//   5. The user doesn't already have an active subscription.
//
// On accept: subscribe via lib/push.ts → toast → set dismissed-at flag
// (so even after success we don't re-prompt). On decline: set flag for
// 7 days. On error: inline error message inside the modal, the dismiss
// flag is NOT set so the user can retry next session.

import { useEffect, useState } from "react";
import { detectPlatform } from "@/lib/platform";
import { isSubscribed, subscribePush, PermissionDeniedError } from "@/lib/push";

const DISMISS_KEY = "babun-push-prompt-dismissed-at";
const SESSION_KEY = "babun-session-count";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type State =
  | { kind: "hidden" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function EnableNotificationsPrompt() {
  const [state, setState] = useState<State>({ kind: "hidden" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { canSubscribePush } = detectPlatform();
      if (!canSubscribePush) return;

      const sessions = readSessionCount();
      if (sessions < 2) return;

      const dismissedAt = readDismissedAt();
      if (dismissedAt && Date.now() - dismissedAt < SEVEN_DAYS_MS) return;

      if (await isSubscribed()) return;

      if (!cancelled) setState({ kind: "ready" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "hidden") return null;

  const submitting = state.kind === "submitting";

  const onAccept = async () => {
    setState({ kind: "submitting" });
    try {
      await subscribePush();
      writeDismissedAt(Date.now());
      setState({ kind: "hidden" });
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        // User declined the OS prompt — same as "Не сейчас".
        writeDismissedAt(Date.now());
        setState({ kind: "hidden" });
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Не удалось включить уведомления";
      setState({ kind: "error", message: msg });
    }
  };

  const onDecline = () => {
    writeDismissedAt(Date.now());
    setState({ kind: "hidden" });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] p-4 animate-backdrop-in"
      onClick={onDecline}
    >
      <div
        className="w-full max-w-sm bg-[var(--surface-card)] rounded-[var(--radius-sheet)] shadow-[var(--shadow-sheet)] p-5 animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[28px]"
            style={{ background: "rgba(31, 102, 215, 0.12)", color: "#1F66D7" }}
            aria-hidden
          >
            🔔
          </div>
          <h2 className="text-[19px] font-semibold text-[var(--label)] tracking-tight">
            Включить уведомления?
          </h2>
        </div>

        <p className="mt-3 text-[14px] leading-snug text-[#3C3C43D9]">
          Получай новые записи и заявки сразу, без открытия приложения.
        </p>

        {state.kind === "error" && (
          <p className="mt-3 text-[13px] leading-snug text-[#B91C1C]">
            {state.message}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={submitting}
            className="h-11 rounded-[12px] bg-[#1F66D7] hover:bg-[#1850A8] disabled:bg-[#7DA8E5] text-white text-[15px] font-semibold transition active:scale-[0.99]"
          >
            {submitting ? "Включаем…" : "Включить"}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={submitting}
            className="h-11 rounded-[12px] text-[var(--label)] text-[15px] font-medium hover:bg-[var(--fill-quaternary)] transition"
          >
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  );
}

function readSessionCount(): number {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(ts));
  } catch {
    // ignore — quota or privacy mode
  }
}

/** Increments the session counter on every dashboard mount.
 *  Mount this once near the root of the dashboard layout so the count
 *  goes up on each fresh page load (good enough heuristic for "session"). */
export function bumpSessionCount(): void {
  try {
    const current = parseInt(window.localStorage.getItem(SESSION_KEY) ?? "0", 10) || 0;
    window.localStorage.setItem(SESSION_KEY, String(current + 1));
  } catch {
    // ignore
  }
}
