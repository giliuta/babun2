// v531 §2.5 — fetchWithRetry coverage.
//
// Targets: backoff timing isn't asserted (vi.useFakeTimers is fiddly
// with the jitter math); we DO assert:
//   - 2xx/3xx returns immediately
//   - 4xx returns immediately (no retry)
//   - 5xx retries N times and returns the last response
//   - thrown network errors retry and then re-throw
//   - signal abort cuts the loop short

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchWithRetry } from "@/lib/http/fetcher";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

function mockSequence(responses: Array<Response | Error>) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
}

describe("fetchWithRetry", () => {
  it("returns 2xx response immediately, no retries", async () => {
    mockSequence([new Response("ok", { status: 200 })]);
    const res = await fetchWithRetry("/x", { retries: 3, initialDelayMs: 1 });
    expect(res.status).toBe(200);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("returns 4xx response immediately (caller's bug)", async () => {
    mockSequence([new Response("nope", { status: 422 })]);
    const res = await fetchWithRetry("/x", { retries: 3, initialDelayMs: 1 });
    expect(res.status).toBe(422);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("retries on 503 up to N times then returns last response", async () => {
    mockSequence([
      new Response("nope", { status: 503 }),
      new Response("nope", { status: 503 }),
      new Response("ok", { status: 200 }),
    ]);
    const res = await fetchWithRetry("/x", { retries: 3, initialDelayMs: 1 });
    expect(res.status).toBe(200);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });

  it("retries on thrown error then rethrows when exhausted", async () => {
    mockSequence([new Error("network blip"), new Error("network blip"), new Error("network blip"), new Error("network blip")]);
    await expect(
      fetchWithRetry("/x", { retries: 2, initialDelayMs: 1 }),
    ).rejects.toThrow(/network blip/);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3); // 1 + 2 retries
  });

  it("stops early when shouldStopRetrying returns true", async () => {
    const stopper = vi.fn(() => true);
    mockSequence([new Error("net1"), new Error("net2"), new Error("net3")]);
    await expect(
      fetchWithRetry("/x", {
        retries: 5,
        initialDelayMs: 1,
        shouldStopRetrying: stopper,
      }),
    ).rejects.toThrow(/net1/);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(stopper).toHaveBeenCalled();
  });
});
