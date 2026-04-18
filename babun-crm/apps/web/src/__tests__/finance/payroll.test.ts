import { describe, it, expect, beforeEach } from "vitest";
import {
  generateWeeklyPercent,
  isoWeekRange,
} from "@/lib/payroll";
import { DEFAULT_BRIGADE_MEMBERS } from "@/lib/brigades";

// Payroll % calculation: Y&D week, revenue €1620 post-discount.
// Lead (Юра, 10%): €162.00 = 16200 cents
// Helper (Даня, 7%): €113.40 = 11340 cents

const PAYMENTS_KEY = "babun2:finance:payments";
const MEMBERS_KEY = "babun2:finance:brigade_members";
const PAYROLL_KEY = "babun2:finance:payroll_periods";

describe("payroll.generateWeeklyPercent", () => {
  const weekRange = isoWeekRange(new Date().toISOString().slice(0, 10));
  // Revenue = €1620 = 162000 cents, across two payments in the week
  const testPayments = [
    {
      id: "p-test-1",
      appointmentId: "a-1",
      clientId: null,
      brigadeId: "br_yd",
      amountCents: 100_000,
      method: "cash",
      paidAt: `${weekRange.start}T10:00:00.000Z`,
      note: "",
      createdAt: `${weekRange.start}T10:00:00.000Z`,
    },
    {
      id: "p-test-2",
      appointmentId: "a-2",
      clientId: null,
      brigadeId: "br_yd",
      amountCents: 62_000,
      method: "card",
      paidAt: `${weekRange.start}T11:00:00.000Z`,
      note: "",
      createdAt: `${weekRange.start}T11:00:00.000Z`,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    // Seed members with joinedAt before the week so the filter includes them
    const members = DEFAULT_BRIGADE_MEMBERS.map((m) => ({
      ...m,
      joinedAt: "2020-01-01T00:00:00.000Z",
    }));
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(testPayments));
    localStorage.setItem(PAYROLL_KEY, JSON.stringify([]));
  });

  it("calculates lead payout as 10% of revenue", () => {
    const period = generateWeeklyPercent("br_yd", weekRange);
    const leadLine = period.lines.find((l) => l.masterId === "m-yura");
    expect(leadLine).toBeDefined();
    expect(leadLine!.amountCents).toBe(16_200); // 10% of 162000
  });

  it("calculates helper payout as 7% of revenue", () => {
    const period = generateWeeklyPercent("br_yd", weekRange);
    const helperLine = period.lines.find((l) => l.masterId === "m-danya-yd");
    expect(helperLine).toBeDefined();
    expect(helperLine!.amountCents).toBe(11_340); // 7% of 162000
  });

  it("returns a draft period with correct metadata", () => {
    const period = generateWeeklyPercent("br_yd", weekRange);
    expect(period.brigadeId).toBe("br_yd");
    expect(period.type).toBe("weekly_percent");
    expect(period.status).toBe("draft");
    expect(period.periodStart).toBe(weekRange.start);
    expect(period.periodEnd).toBe(weekRange.end);
    expect(period.totalCents).toBe(16_200 + 11_340);
  });

  it("produces zero payouts when no payments exist in range", () => {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
    const period = generateWeeklyPercent("br_yd", weekRange);
    expect(period.totalCents).toBe(0);
    period.lines.forEach((l) => expect(l.amountCents).toBe(0));
  });
});
