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

import { useEffect, useRef, useState } from "react";
import { detectPlatform } from "@/lib/platform";
import { isSubscribed, subscribePush, PermissionDeniedError } from "@/lib/push";
import { registerModalBack } from "@/lib/history-stack";

const DISMISS_KEY = "babun-push-prompt-dismissed-at";
const SESSION_KEY = "babun-session-count";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// STORY-082 — once per session gate, same as InstallPrompt. Empty
// tenants used to see push + install popups stacked on the empty
// calendar before they had any data to be notified about.
const SESSION_ONCE_KEY = "babun-push-prompt-shown-session";

type State =
  | { kind: "hidden" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function EnableNotificationsPrompt() {
  const [state, setState] = useState<State>({ kind: "hidden" });
  const popCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { canSubscribePush } = detectPlatform();
      if (!canSubscribePush) return;

      const sessions = readSessionCount();
      if (sessions < 2) return;

      // STORY-082 — once per browser tab session, full stop.
      if (typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_ONCE_KEY) === "1") return;

      const dismissedAt = readDismissedAt();
      if (dismissedAt && Date.now() - dismissedAt < SEVEN_DAYS_MS) return;

      if (await isSubscribed()) return;

      // STORY-082 — never prompt before the user has at least one
      // appointment. Empty calendar tenant with no data has nothing
      // worth being notified about; the popup just looks like noise.
      if (!hasAnyAppointmentLocally()) return;

      if (!cancelled) {
        // Note: we DO NOT mark-shown here. The mark is applied only
        // when the user actually decides (accept / decline / back).
        // If they navigate away mid-prompt the prompt should be able
        // to reappear — they hadn't truly seen it through.
        setState({ kind: "ready" });
      }
    })();
    return () => {
      cancelled = true;
      popCloseRef.current?.();
      popCloseRef.current = null;
    };
  }, []);

  // Register hardware-back handler whenever the prompt is visible.
  useEffect(() => {
    if (state.kind === "hidden") {
      popCloseRef.current?.();
      popCloseRef.current = null;
      return;
    }
    if (popCloseRef.current) return;
    popCloseRef.current = registerModalBack("enable-notifications", () => {
      writeDismissedAt(Date.now());
      markShownThisSession();
      setState({ kind: "hidden" });
    });
  }, [state.kind]);

  if (state.kind === "hidden") return null;

  const submitting = state.kind === "submitting";

  const onAccept = async () => {
    setState({ kind: "submitting" });
    try {
      await subscribePush();
      writeDismissedAt(Date.now());
      markShownThisSession();
      setState({ kind: "hidden" });
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        // User declined the OS prompt — same as "Не сейчас".
        writeDismissedAt(Date.now());
        markShownThisSession();
        setState({ kind: "hidden" });
        return;
      }
      // On a real error (network / push service down) we leave the
      // session-shown flag *unset* so the user gets a fresh chance
      // next time. The dismiss flag is also not written.
      const msg =
        err instanceof Error ? err.message : "Не удалось включить уведомления";
      setState({ kind: "error", message: msg });
    }
  };

  const onDecline = () => {
    writeDismissedAt(Date.now());
    markShownThisSession();
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
            className="w-12 h-12 rounded-full flex items-center justify-center text-[28px] bg-[var(--accent-tint)] text-[var(--accent)]"
            aria-hidden
          >
            🔔
          </div>
          <h2 className="text-[19px] font-semibold text-[var(--label)] tracking-tight">
            Включить уведомления?
          </h2>
        </div>

        <p className="mt-3 text-[14px] leading-snug text-[var(--label-secondary)]">
          Получай новые записи и заявки сразу, без открытия приложения.
        </p>

        {state.kind === "error" && (
          <p className="mt-3 text-[13px] leading-snug text-[var(--system-red)]">
            {state.message}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={submitting}
            className="h-11 rounded-[12px] bg-[var(--accent)] active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] text-[var(--label-on-accent)] text-[15px] font-semibold transition active:scale-[0.99]"
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

function markShownThisSession(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SESSION_ONCE_KEY, "1");
  } catch {
    /* ignore */
  }
}

// STORY-082 — fires only when the tenant has at least one
// appointment cached locally. New empty-calendar tenants don't see
// the prompt until they have something to be notified about.
function hasAnyAppointmentLocally(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem("babun-appointments");
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    return false;
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
