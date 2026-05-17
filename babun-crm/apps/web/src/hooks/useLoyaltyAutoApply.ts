"use client";

/**
 * useLoyaltyAutoApply — Beta #53 (CRM Core brief).
 *
 * Auto-applies the loyalty tier discount on the appointment whenever
 * the operator picks a client. Replaces only its own auto-applied
 * value, so a manual «скидка постоянному = 8%, индивидуально» typed
 * by the dispatcher always wins and is preserved across re-renders.
 *
 * Extracted from AppointmentSheet (Sprint #4 §9 step 5, v627).
 */

import { useEffect, useState } from "react";
import type { Discount } from "@babun/shared/local/appointments";
import { loadLoyalty, tierForVisits } from "@babun/shared/local/loyalty";

interface UseLoyaltyAutoApplyArgs {
  clientId: string | null;
  visitsForClient: ((clientId: string) => number) | undefined;
  globalDiscount: Discount | null;
  setGlobalDiscount: React.Dispatch<React.SetStateAction<Discount | null>>;
}

export function useLoyaltyAutoApply({
  clientId,
  visitsForClient,
  setGlobalDiscount,
}: UseLoyaltyAutoApplyArgs): void {
  // Tracks whether the current globalDiscount came from the auto-apply
  // path (replaceable) vs a manual edit (sticky).
  const [loyaltyApplied, setLoyaltyApplied] = useState<{
    clientId: string;
    percent: number;
  } | null>(null);

  useEffect(() => {
    if (!visitsForClient || !clientId) {
      // Drop a stale auto-applied discount when the client is cleared.
      if (loyaltyApplied !== null) {
        setGlobalDiscount((current) =>
          current?.type === "percent" && current.value === loyaltyApplied.percent
            ? null
            : current,
        );
        setLoyaltyApplied(null);
      }
      return;
    }
    const visits = visitsForClient(clientId);
    const tier = tierForVisits(visits, loadLoyalty());
    if (!tier) {
      // Client doesn't qualify (or program is off) — drop the
      // previously auto-applied tier if any.
      if (loyaltyApplied !== null) {
        setGlobalDiscount((current) =>
          current?.type === "percent" && current.value === loyaltyApplied.percent
            ? null
            : current,
        );
        setLoyaltyApplied(null);
      }
      return;
    }
    // Apply the tier discount. Skip when the operator has already
    // typed a non-loyalty discount we shouldn't overwrite.
    setGlobalDiscount((current) => {
      const wasAutoApplied =
        loyaltyApplied?.clientId === clientId &&
        current?.type === "percent" &&
        current.value === loyaltyApplied.percent;
      if (!current || wasAutoApplied) {
        return {
          type: "percent",
          value: tier.percent,
          reason: tier.label,
        };
      }
      return current; // manual edit wins
    });
    setLoyaltyApplied({ clientId, percent: tier.percent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, visitsForClient]);
}
