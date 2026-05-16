// v531 §2.5 — Exponential-backoff retry wrapper for fetch().
//
// Use this in client + server code that talks to external services
// (Supabase Auth admin endpoints, third-party APIs, our own
// /api/* routes that aren't going through Supabase SDK). Behaviour:
//
//   - Retries on 5xx response status AND on thrown network errors
//     (DNS, connection refused, timeout).
//   - Backoff: 300 ms × 2^attempt + jitter (300, 700, 1500, 3100 ms).
//   - Default 3 retries (4 total attempts). Override via `retries`.
//   - 4xx responses are returned verbatim (caller's bug, not ours).
//   - AbortSignal honoured throughout: every wait is cancellable.
//
// What this DOES NOT cover:
//
//   - RSC navigation 5xx. Those requests are owned by Next's router
//     prefetch / streaming machinery, and the runtime applies its
//     own retries. The user-visible 503 on /chats?_rsc=… should be
//     watched via Sentry (§5.1) + Vercel function logs; debug the
//     cold-start path, don't try to retry from userland.
//   - Supabase repo calls (clientsCached / appointmentsCached).
//     Those already absorb errors into the offline IDB queue and
//     surface them via the sync-error bus (v509).
//
// Sentry integration: when reportSyncError is wired up via the bus,
// failed final attempts also notify the user via the red pill in
// OfflineIndicator. Caller-side try/catch decides whether to call
// reportSyncError — keep the wrapper itself silent so it stays
// composable.

import { reportSyncError } from "@/lib/sync/sync-error-bus";

export interface FetchWithRetryOptions extends RequestInit {
  /** Number of retries after the first attempt. Default 3 (4 total). */
  retries?: number;
  /** Initial backoff delay (ms). Each retry doubles + adds jitter. */
  initialDelayMs?: number;
  /** Stops retries early if true. Default false. */
  shouldStopRetrying?: (error: unknown, attempt: number) => boolean;
  /** If true, report the final failure to the sync-error bus so
   *  OfflineIndicator surfaces it. Default false — let the caller
   *  decide what's user-visible. */
  reportFinalFailure?: boolean;
  /** Free-form tag for logs / Sentry. */
  context?: string;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 300;

function jitter(ms: number): number {
  // ±25 % jitter to avoid thundering-herd retries when many clients
  // recover from a shared outage at the same instant.
  return ms * (0.75 + Math.random() * 0.5);
}

async function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) throw new Error("aborted");
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/** Status codes worth retrying. 408 (request timeout) and 429 (rate
 *  limit) are explicitly here on top of the 5xx range. */
function isRetryableStatus(status: number): boolean {
  if (status >= 500 && status < 600) return true;
  if (status === 408) return true;
  if (status === 429) return true;
  return false;
}

/** Retries `fetch(input, init)` with exponential backoff until either:
 *
 *   1. A 2xx/3xx/4xx response lands (returned as-is).
 *   2. `retries` attempts are exhausted (last error is thrown OR last
 *      retryable-status response is returned, depending on which
 *      mode hit the limit).
 *
 *  Network errors surface as thrown Errors; 5xx responses surface as
 *  the Response object. Callers decide what to do with each. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    shouldStopRetrying,
    reportFinalFailure = false,
    context,
    ...rest
  } = init;

  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, rest);
      if (!isRetryableStatus(response.status)) {
        return response;
      }
      lastResponse = response;
      lastError = new Error(
        `${context ? `[${context}] ` : ""}HTTP ${response.status}`,
      );
    } catch (err) {
      lastError = err;
    }

    if (shouldStopRetrying?.(lastError, attempt)) break;
    if (attempt === retries) break;

    const wait = jitter(initialDelayMs * Math.pow(2, attempt));
    try {
      await delay(wait, rest.signal ?? null);
    } catch {
      // Aborted mid-wait — propagate the original error.
      break;
    }
  }

  if (reportFinalFailure && lastError) {
    reportSyncError(lastError);
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("fetchWithRetry: unknown failure");
}

/** Convenience wrapper that JSON-parses a successful response and
 *  surfaces the parsed body or throws an Error with the response
 *  status text. Useful for talking to JSON-only endpoints. */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: FetchWithRetryOptions = {},
): Promise<T> {
  const response = await fetchWithRetry(input, init);
  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      `HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`,
    );
  }
  return (await response.json()) as T;
}
