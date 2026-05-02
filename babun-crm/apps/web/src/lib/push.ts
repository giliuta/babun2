// STORY-053b — client-side push subscribe/unsubscribe helpers.
//
// The subscribe flow:
//   1. Caller checks `detectPlatform().canSubscribePush` upstream.
//   2. requestNotificationPermission() — browser prompt.
//   3. subscribePush() — calls SW registration.pushManager.subscribe
//      with the public VAPID key, then POST /api/push/subscribe.
//
// Errors surface as Error subclasses so callers can distinguish
// (a) user denied permission vs (b) network/server failure.

import { detectPlatform } from "./platform";

export class PermissionDeniedError extends Error {
  constructor() {
    super("Notification permission denied");
    this.name = "PermissionDeniedError";
  }
}

export class PushUnavailableError extends Error {
  constructor(reason: string) {
    super(`Push unavailable: ${reason}`);
    this.name = "PushUnavailableError";
  }
}

/** ArrayBuffer / base64-url conversion helpers. The Web Push spec uses
 *  base64-url (no padding) — Supabase column expects the same shape. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** Subscribe the current device. Throws on failure. Returns the
 *  PushSubscription so callers can inspect endpoint if needed. */
export async function subscribePush(): Promise<PushSubscription> {
  const { canSubscribePush, deviceLabel } = detectPlatform();
  if (!canSubscribePush) {
    throw new PushUnavailableError("platform does not support web push");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new PushUnavailableError("NEXT_PUBLIC_VAPID_PUBLIC_KEY missing");
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    throw new PermissionDeniedError();
  }

  const registration = await navigator.serviceWorker.ready;

  // Reuse an existing subscription if present — saves the user a round
  // trip to the push service. Different devices have different endpoints
  // so this still creates separate rows per device.
  let sub: PushSubscription | null = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const p256dhBuf = sub.getKey("p256dh");
  const authBuf = sub.getKey("auth");
  if (!p256dhBuf || !authBuf) {
    throw new PushUnavailableError("subscription missing keys");
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(p256dhBuf),
        auth: arrayBufferToBase64Url(authBuf),
      },
      deviceLabel,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new PushUnavailableError(`server rejected subscribe: ${res.status} ${t}`);
  }

  return sub;
}

/** Unsubscribe — removes the SW-side subscription AND the server row.
 *  Best-effort: if either side fails, we surface but don't roll back. */
export async function unsubscribePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** True if the user already has an active subscription on this device.
 *  Useful for the settings toggle / EnableNotificationsPrompt gating. */
export async function isSubscribed(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
