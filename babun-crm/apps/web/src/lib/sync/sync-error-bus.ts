"use client";

// v509 — global sync-error surface for the kitchen-sink tenant_state
// backup path. Writes that fail through clientsCached/appointmentsCached
// are absorbed by the offline queue (visible as «Синхронизация: N» in
// OfflineIndicator) so the user can retry from the queue panel. But
// `tenant-state-backup.saveTenantState` has no queue — when it errors
// the data simply doesn't reach the server and we silently console.warn.
// That's the exact failure mode behind the user's «не сохраняется»
// paranoia (masters/teams/services/sms-templates/etc all flow through
// that single blob).
//
// This module is a tiny store + useSyncExternalStore hook. Callers
// report errors via reportSyncError(); successful writes clear via
// clearSyncError(). OfflineIndicator surfaces the latest error as a
// red pill so the user knows to retry — and to clear the warning
// once a follow-up save lands.

import { useSyncExternalStore } from "react";
// v541 §5.1 — every reported sync error is forwarded to the telemetry
// façade. With no adapter installed (default) this is a no-op; when
// Sentry is wired up at app bootstrap, the same failures land in
// the dashboard with the «sync» tag attached.
import { captureException } from "@/lib/observability/telemetry";

export interface SyncErrorState {
  /** Latest unacknowledged error, or null when nothing's pending. */
  lastError: { message: string; at: number } | null;
}

let state: SyncErrorState = { lastError: null };
const subscribers = new Set<() => void>();

function emit(): void {
  for (const fn of subscribers) fn();
}

// v665 — banner UX policy.
//
// Old behaviour: single failure → instant red pill, persistent until
// a successful save lands. On Cyprus 5G one transient blip painted
// the red pill for the rest of the session, even after retries
// succeeded — the user perceived it as "constant sync failure" when
// 99 % of writes actually went through.
//
// New policy:
//   • One isolated failure: silent. Counter goes 0 → 1, no pill.
//   • Two-or-more failures within a 30 s window: surface the pill.
//   • Any successful save: counter back to 0, pill cleared.
//   • No new errors for 30 s after the last one: counter back to 0,
//     pill auto-clears (we treat the lull as a successful idle).
//
// This gives the user signal when something is actually wrong
// (≥2 fails close together, "I should look at this") without
// turning every flaky-LTE moment into a red flag.
const SURFACE_THRESHOLD = 2;
const AUTO_CLEAR_MS = 30_000;
let recentFailureCount = 0;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoClear(): void {
  if (autoClearTimer) clearTimeout(autoClearTimer);
  autoClearTimer = setTimeout(() => {
    autoClearTimer = null;
    recentFailureCount = 0;
    if (state.lastError !== null) {
      state = { lastError: null };
      emit();
    }
  }, AUTO_CLEAR_MS);
}

// Supabase / PostgREST reject with plain objects { code, details, hint,
// message }, not Error instances — so the old `String(err)` rendered
// «[object Object]» both in the sync pill and as the Sentry issue title
// (BABUN-WEB-B), making failures undiagnosable. Pull the real message
// (prefixed with the PG error code when present) out instead; the full
// payload still rides along as `extras.original` below.
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) {
      return typeof o.code === "string" && o.code
        ? `[${o.code}] ${o.message}`
        : o.message;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      /* circular reference — fall through to String() */
    }
  }
  return String(err);
}

export function reportSyncError(err: unknown): void {
  const message = extractErrorMessage(err);
  recentFailureCount += 1;
  if (recentFailureCount >= SURFACE_THRESHOLD) {
    state = { lastError: { message, at: Date.now() } };
    emit();
  }
  scheduleAutoClear();
  // v541 §5.1 — fan out to telemetry. No-op without Sentry adapter;
  // with Sentry installed, the error lands in the dashboard tagged
  // `subsystem=sync` so the user-pill UX and the error inbox stay
  // in sync (pun intended).
  //
  // Supabase rejects with PostgrestError-shaped plain objects
  // `{ code, details, hint, message }`, not Error instances. Passing
  // them straight to Sentry produced the BABUN-WEB-7 / BABUN-WEB-9
  // noise: «Object captured as exception with keys: code, details,
  // hint, message» — no stack, hard to triage. Wrap non-Error values
  // in a real Error so Sentry gets a stack from this point and
  // keep the original payload as extra context.
  const wrapped =
    err instanceof Error
      ? err
      : Object.assign(new Error(message), { name: "SyncError" });
  const extras: Record<string, unknown> = { subsystem: "sync" };
  if (!(err instanceof Error) && typeof err === "object" && err !== null) {
    extras.original = err;
  }
  captureException(wrapped, extras);
}

export function clearSyncError(): void {
  // A successful save resets BOTH the visible state and the
  // back-off counter — next single failure goes back to silent.
  recentFailureCount = 0;
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
  if (state.lastError !== null) {
    state = { lastError: null };
    emit();
  }
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): SyncErrorState {
  return state;
}

function getServerSnapshot(): SyncErrorState {
  // SSR-safe — first paint never shows an error.
  return { lastError: null };
}

export function useSyncError(): SyncErrorState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
