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

export interface SyncErrorState {
  /** Latest unacknowledged error, or null when nothing's pending. */
  lastError: { message: string; at: number } | null;
}

let state: SyncErrorState = { lastError: null };
const subscribers = new Set<() => void>();

function emit(): void {
  for (const fn of subscribers) fn();
}

export function reportSyncError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  state = { lastError: { message, at: Date.now() } };
  emit();
}

export function clearSyncError(): void {
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
