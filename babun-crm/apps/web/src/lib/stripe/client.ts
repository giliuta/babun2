// STORY-052 G2 — Stripe server SDK singleton with lazy init.
//
// Why lazy:
//   * The Stripe constructor reads STRIPE_SECRET_KEY at construction
//     time. If we instantiate at module import, any deploy without
//     the env var crashes at startup (Next build / cold start).
//   * Most page renders DON'T touch Stripe. Settings UI gracefully
//     degrades to a "Платежи временно недоступны" placeholder when
//     `getStripeOrThrow()` raises 'stripe_not_configured'.
//
// Why typed errors:
//   * Server actions catch this and surface a localized RU message
//     to the UI. Raw Stripe SDK exceptions (StripeAPIError,
//     StripeRateLimitError, etc.) are useful in logs but not in
//     toasts.
//
// API version pinned. Bumping is a deliberate one-line change in
// this file + a re-test of the webhook event shapes.

import Stripe from "stripe";

// Pinned to whatever the installed stripe SDK declares as its
// LatestApiVersion. Bumping the SDK is the trigger to re-test the
// webhook event shape.
const STRIPE_API_VERSION = "2025-08-27.basil" as const;

export class StripeNotConfiguredError extends Error {
  readonly code = "stripe_not_configured" as const;
  constructor() {
    super(
      "Stripe is not configured (STRIPE_SECRET_KEY env var missing). " +
        "Set in Vercel Project Settings → Environment Variables.",
    );
    this.name = "StripeNotConfiguredError";
  }
}

let _stripe: Stripe | null = null;

/** Returns the singleton Stripe SDK instance. Throws
 *  `StripeNotConfiguredError` when STRIPE_SECRET_KEY is missing —
 *  callers catch and map to a typed UI error. */
export function getStripeOrThrow(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  _stripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    // Vercel runs Node >=18; node-fetch is the default. Disable
    // telemetry + set a stable app name for Stripe's request logs.
    appInfo: {
      name: "Babun CRM",
      url: "https://babun.app",
    },
    telemetry: false,
  });
  return _stripe;
}

/** Cheap check used by the Settings UI server-render to decide
 *  whether to show the "Платежи временно недоступны" placeholder
 *  vs the live upgrade flow. Doesn't require the SDK to be
 *  reachable — only that the env var is set. */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Reads the price IDs that point at the Stripe Products created
 *  in the Dashboard. Both required for the upgrade flow. Returns
 *  null when either is missing — Settings UI shows a
 *  "Платежи временно недоступны" placeholder in that case. */
export function getStripePriceIds(): { pro: string; business: string } | null {
  const pro = process.env.STRIPE_PRICE_PRO;
  const business = process.env.STRIPE_PRICE_BUSINESS;
  if (!pro || !business) return null;
  return { pro, business };
}
