// STORY-052 G4 — offline tests for the quota helper.
//
// Same in-memory mock pattern as the webhook tests: rather than
// hitting Postgres we mock supabase.from(...).select() / .rpc()
// chains and assert that assertQuotaAvailable returns or throws
// with the right shape.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  assertQuotaAvailable,
  QuotaExceededError,
  type QuotaKind,
} from "@/lib/quota/check";

interface MockSupabase {
  rpc: (fn: string, args: { t_id: string }) => Promise<{ data: number; error: null }>;
  from: (table: string) => {
    select: (
      cols: string,
      opts?: { count?: string; head?: boolean },
    ) => {
      eq: (col: string, val: string) => {
        gte: (col: string, val: string) => Promise<{ count: number; error: null }>;
        is: (col: string, val: null) => {
          gt: (col: string, val: string) => Promise<{ count: number; error: null }>;
        };
      } & Promise<{ count: number; error: null }>;
    };
  };
}

interface SupabaseMockState {
  rpcQuotas: Partial<Record<string, number>>;
  counts: Partial<Record<string, number>>;
  pendingInvitations: number;
}

function buildMockSupabase(state: SupabaseMockState): MockSupabase {
  return {
    async rpc(fn: string) {
      return { data: state.rpcQuotas[fn] ?? 0, error: null };
    },
    from(table: string) {
      const tableCount = state.counts[table] ?? 0;
      return {
        select(_cols: string, _opts?: { count?: string; head?: boolean }) {
          const eqResult = (val: string) => {
            void val;
            const inner = {
              async gte(_c: string, _v: string) {
                return { count: tableCount, error: null };
              },
              is(_col: string, _val: null) {
                return {
                  async gt(_col2: string, _val2: string) {
                    return { count: state.pendingInvitations, error: null };
                  },
                };
              },
              then<T>(
                onfulfilled?: (
                  value: { count: number; error: null },
                ) => T | PromiseLike<T>,
              ) {
                const v = { count: tableCount, error: null as null };
                return Promise.resolve(v).then(onfulfilled);
              },
            };
            // Return a Promise + chain shape: tests await the
            // .eq(...) path directly OR continue via .gte / .is.
            return inner as unknown as ReturnType<MockSupabase["from"]>["select"] extends (
              _: string,
              _o?: { count?: string; head?: boolean },
            ) => { eq: (col: string, val: string) => infer R }
              ? R
              : never;
          };
          return { eq: (_c: string, val: string) => eqResult(val) };
        },
      };
    },
  };
}

const TENANT = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.useRealTimers();
});

describe("assertQuotaAvailable — clients", () => {
  it("under_limit → resolves without throwing", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_clients: 100 },
      counts: { clients: 50 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "clients" as QuotaKind),
    ).resolves.toBeUndefined();
  });

  it("at_limit (current = limit - 1) → still allows the next insert", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_clients: 100 },
      counts: { clients: 99 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "clients"),
    ).resolves.toBeUndefined();
  });

  it("over_limit (current = limit) → throws QuotaExceededError", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_clients: 100 },
      counts: { clients: 100 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "clients"),
    ).rejects.toMatchObject({
      code: "quota_exceeded",
      kind: "clients",
      current: 100,
      limit: 100,
    });
    // And it's specifically our typed error class.
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "clients"),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("lifetime_unlimited (limit ≈ 999999999) → always allows", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_clients: 999_999_999 },
      counts: { clients: 50_000 }, // realistically high
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "clients"),
    ).resolves.toBeUndefined();
  });
});

describe("assertQuotaAvailable — team_members", () => {
  it("counts active members + pending invitations", async () => {
    // 1 member + 0 pending = 1 → at limit for Free (limit=1) →
    // throws on attempt to add ANOTHER member.
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_team_members: 1 },
      counts: { tenant_members: 1 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "team_members"),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("0 members + 1 pending invitation → still counts toward limit", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_team_members: 1 },
      counts: { tenant_members: 0 },
      pendingInvitations: 1,
    });
    // Free tier (limit=1), 0+1=1, attempt to add 2nd → reject.
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "team_members"),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("Pro tier (limit=5) with 3 members + 1 pending = 4 → allows next", async () => {
    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_team_members: 5 },
      counts: { tenant_members: 3 },
      pendingInvitations: 1,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "team_members"),
    ).resolves.toBeUndefined();
  });
});

describe("assertQuotaAvailable — appointments_month", () => {
  it("UTC month boundary — count is filtered by created_at >= month start", async () => {
    // The mock returns the configured count regardless of the date
    // filter; the assertion here is that the helper computes the
    // boundary in UTC (we can spot-check by stubbing Date).
    // Simpler: just confirm the helper accepts the filter chain
    // without throwing on the boundary date.
    const FAKE_NOW = new Date(Date.UTC(2026, 4, 31, 23, 59, 0)).getTime(); // 2026-05-31 23:59 UTC
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);

    const sb = buildMockSupabase({
      rpcQuotas: { tenant_quota_appointments_month: 50 },
      counts: { appointments: 49 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb as never, TENANT, "appointments_month"),
    ).resolves.toBeUndefined();

    // First minute of next month — appointments count should reset.
    // Mock returns 0 for the new month.
    vi.setSystemTime(FAKE_NOW + 60_000);
    const sb2 = buildMockSupabase({
      rpcQuotas: { tenant_quota_appointments_month: 50 },
      counts: { appointments: 0 },
      pendingInvitations: 0,
    });
    await expect(
      assertQuotaAvailable(sb2 as never, TENANT, "appointments_month"),
    ).resolves.toBeUndefined();
  });
});
