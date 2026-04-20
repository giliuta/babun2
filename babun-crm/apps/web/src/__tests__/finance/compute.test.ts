import { describe, it, expect } from "vitest";
import {
  computeFinancials,
  inFinanceRange,
  datesInFinanceRange,
  centsToEur,
} from "@/lib/finance/compute";
import type { Appointment } from "@/lib/appointments";

// Minimal Appointment factory — keep only what computeFinancials reads.
// `as Appointment` cast is deliberate: the production type has many
// fields that don't affect compute.ts, and enumerating all of them here
// would obscure the test. computeFinancials never touches them.
function apt(partial: Partial<Appointment> & {
  id: string;
  date: string;
  team_id: string;
  status?: Appointment["status"];
}): Appointment {
  return {
    id: partial.id,
    date: partial.date,
    time_start: partial.time_start ?? "10:00",
    time_end: partial.time_end ?? "11:00",
    client_id: partial.client_id ?? null,
    location_id: partial.location_id ?? null,
    team_id: partial.team_id,
    service_ids: partial.service_ids ?? [],
    payment: partial.payment ?? null,
    services: partial.services ?? [],
    global_discount: partial.global_discount ?? null,
    total_duration: partial.total_duration ?? 60,
    total_amount: partial.total_amount ?? 100,
    custom_total: partial.custom_total ?? false,
    discount_amount: partial.discount_amount ?? 0,
    expenses: partial.expenses ?? [],
    service_price_overrides: partial.service_price_overrides ?? {},
    status: partial.status ?? "completed",
    payments: partial.payments ?? [
      { id: "p1", method: "cash", amount: 100, paid_at: "" },
    ],
    prepaid_amount: partial.prepaid_amount ?? 0,
    photos: partial.photos ?? [],
    comment: partial.comment ?? "",
    consent_given: partial.consent_given ?? false,
    created_at: partial.created_at ?? "",
    updated_at: partial.updated_at ?? "",
  } as Appointment;
}

const noExtras = () => [];
const team = { id: "t1", name: "Y&D" } as never; // only `.id` and `.name` are read

describe("centsToEur", () => {
  it("rounds to nearest euro", () => {
    expect(centsToEur(0)).toBe(0);
    expect(centsToEur(4999)).toBe(50);
    expect(centsToEur(5001)).toBe(50);
    expect(centsToEur(12345)).toBe(123);
  });
});

describe("inFinanceRange", () => {
  it("includes endpoints", () => {
    const r = { from: "2026-04-01", to: "2026-04-30" };
    expect(inFinanceRange("2026-04-01", r)).toBe(true);
    expect(inFinanceRange("2026-04-30", r)).toBe(true);
    expect(inFinanceRange("2026-04-15", r)).toBe(true);
    expect(inFinanceRange("2026-03-31", r)).toBe(false);
    expect(inFinanceRange("2026-05-01", r)).toBe(false);
  });

  it("treats null from as all-time", () => {
    const r = { from: null, to: "2026-04-30" };
    expect(inFinanceRange("2020-01-01", r)).toBe(true);
    expect(inFinanceRange("2026-05-01", r)).toBe(false);
  });
});

describe("datesInFinanceRange", () => {
  it("enumerates inclusive dates", () => {
    const dates = datesInFinanceRange({ from: "2026-04-01", to: "2026-04-03" });
    expect(dates).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });

  it("returns empty for all-time range", () => {
    expect(datesInFinanceRange({ from: null, to: "2026-04-30" })).toEqual([]);
  });
});

describe("computeFinancials", () => {
  it("sums appointment payments as income", () => {
    const res = computeFinancials({
      appointments: [apt({ id: "a1", date: "2026-04-10", team_id: "t1", total_amount: 150, payments: [{ id: "p", method: "cash", amount: 150, paid_at: "" }] })],
      services: [],
      teams: [team],
      dayExtrasOf: noExtras,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(res.totalIncome).toBe(150);
    expect(res.cash).toBe(150);
    expect(res.card).toBe(0);
    expect(res.profit).toBe(150);
    expect(res.margin).toBe(100);
  });

  it("splits cash and card from mixed payments", () => {
    const res = computeFinancials({
      appointments: [
        apt({
          id: "a1",
          date: "2026-04-10",
          team_id: "t1",
          total_amount: 200,
          payments: [
            { id: "p1", method: "cash", amount: 50, paid_at: "" },
            { id: "p2", method: "card", amount: 150, paid_at: "" },
          ],
        }),
      ],
      services: [],
      teams: [team],
      dayExtrasOf: noExtras,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(res.cash).toBe(50);
    expect(res.card).toBe(150);
    expect(res.totalIncome).toBe(200);
  });

  it("ignores appointments outside the range", () => {
    const res = computeFinancials({
      appointments: [
        apt({ id: "a1", date: "2026-03-25", team_id: "t1" }),
        apt({ id: "a2", date: "2026-04-10", team_id: "t1" }),
      ],
      services: [],
      teams: [team],
      dayExtrasOf: noExtras,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(res.incomeLines).toHaveLength(1);
    expect(res.incomeLines[0].refId).toBe("a2");
  });

  it("converts standalone FinancePayment amountCents to euros", () => {
    const res = computeFinancials({
      appointments: [],
      services: [],
      teams: [team],
      dayExtrasOf: noExtras,
      standalonePayments: [
        {
          id: "sp1",
          appointmentId: "",
          clientId: null,
          brigadeId: "t1",
          amountCents: 12345, // €123.45 → rounds to €123
          method: "cash",
          paidAt: "2026-04-15T12:00:00Z",
          note: "sample",
          createdAt: "",
        },
      ],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(res.totalIncome).toBe(123);
    expect(res.cash).toBe(123);
  });

  it("respects teamFilter for brigade-scope filtering", () => {
    const res = computeFinancials({
      appointments: [
        apt({ id: "a1", date: "2026-04-10", team_id: "t1", total_amount: 100, payments: [{ id: "p", method: "cash", amount: 100, paid_at: "" }] }),
        apt({ id: "a2", date: "2026-04-10", team_id: "t2", total_amount: 200, payments: [{ id: "p", method: "cash", amount: 200, paid_at: "" }] }),
      ],
      services: [],
      teams: [team, { id: "t2", name: "D&K" } as never],
      dayExtrasOf: noExtras,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
      teamFilter: "t1",
    });
    expect(res.totalIncome).toBe(100);
    expect(res.incomeLines).toHaveLength(1);
  });

  it("skips appointments whose status is scheduled or cancelled", () => {
    const res = computeFinancials({
      appointments: [
        apt({ id: "a1", date: "2026-04-10", team_id: "t1", status: "scheduled" }),
        apt({ id: "a2", date: "2026-04-10", team_id: "t1", status: "cancelled" }),
        apt({ id: "a3", date: "2026-04-10", team_id: "t1", status: "completed" }),
      ],
      services: [],
      teams: [team],
      dayExtrasOf: noExtras,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(res.incomeLines).toHaveLength(1);
    expect(res.incomeLines[0].refId).toBe("a3");
  });
});
