import { describe, it, expect, beforeEach } from "vitest";
import { buildReconciliationForBrigadeDay } from "@/lib/reconciliations";

const PAYMENTS_KEY = "babun2:finance:payments";

describe("reconciliations.buildReconciliationForBrigadeDay", () => {
  const DATE = "2025-06-15";

  beforeEach(() => {
    localStorage.clear();
  });

  it("expectedCashCents equals sum of cash payments for brigade on that day", () => {
    localStorage.setItem(
      PAYMENTS_KEY,
      JSON.stringify([
        { id: "p1", appointmentId: "a1", clientId: null, brigadeId: "br_yd", amountCents: 10_000, method: "cash", paidAt: `${DATE}T09:00:00.000Z`, note: "", createdAt: `${DATE}T09:00:00.000Z` },
        { id: "p2", appointmentId: "a2", clientId: null, brigadeId: "br_yd", amountCents: 5_000, method: "cash", paidAt: `${DATE}T14:00:00.000Z`, note: "", createdAt: `${DATE}T14:00:00.000Z` },
        // card payment — should NOT be included in expectedCash
        { id: "p3", appointmentId: "a3", clientId: null, brigadeId: "br_yd", amountCents: 3_000, method: "card", paidAt: `${DATE}T15:00:00.000Z`, note: "", createdAt: `${DATE}T15:00:00.000Z` },
      ])
    );

    const recon = buildReconciliationForBrigadeDay("br_yd", DATE);
    expect(recon.expectedCashCents).toBe(15_000);
    expect(recon.actualCashCents).toBe(0);
    expect(recon.differenceCents).toBe(-15_000);
  });

  it("appointmentIds contains unique appointment IDs from payments", () => {
    localStorage.setItem(
      PAYMENTS_KEY,
      JSON.stringify([
        { id: "p1", appointmentId: "a1", clientId: null, brigadeId: "br_yd", amountCents: 5_000, method: "cash", paidAt: `${DATE}T09:00:00.000Z`, note: "", createdAt: `${DATE}T09:00:00.000Z` },
        { id: "p2", appointmentId: "a1", clientId: null, brigadeId: "br_yd", amountCents: 5_000, method: "cash", paidAt: `${DATE}T09:30:00.000Z`, note: "", createdAt: `${DATE}T09:30:00.000Z` },
        { id: "p3", appointmentId: "a2", clientId: null, brigadeId: "br_yd", amountCents: 5_000, method: "cash", paidAt: `${DATE}T10:00:00.000Z`, note: "", createdAt: `${DATE}T10:00:00.000Z` },
      ])
    );

    const recon = buildReconciliationForBrigadeDay("br_yd", DATE);
    expect(recon.appointmentIds).toHaveLength(2);
    expect(recon.appointmentIds).toContain("a1");
    expect(recon.appointmentIds).toContain("a2");
  });

  it("ignores payments from different brigade", () => {
    localStorage.setItem(
      PAYMENTS_KEY,
      JSON.stringify([
        { id: "p1", appointmentId: "a1", clientId: null, brigadeId: "br_yd", amountCents: 8_000, method: "cash", paidAt: `${DATE}T09:00:00.000Z`, note: "", createdAt: `${DATE}T09:00:00.000Z` },
        { id: "p2", appointmentId: "a2", clientId: null, brigadeId: "br_dk", amountCents: 6_000, method: "cash", paidAt: `${DATE}T10:00:00.000Z`, note: "", createdAt: `${DATE}T10:00:00.000Z` },
      ])
    );

    const recon = buildReconciliationForBrigadeDay("br_yd", DATE);
    expect(recon.expectedCashCents).toBe(8_000);
  });

  it("returns zero expectedCashCents when no payments exist", () => {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
    const recon = buildReconciliationForBrigadeDay("br_yd", DATE);
    expect(recon.expectedCashCents).toBe(0);
    expect(recon.differenceCents).toBe(0);
    expect(recon.appointmentIds).toHaveLength(0);
  });
});
