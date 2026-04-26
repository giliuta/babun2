// Cyprus VAT helpers. All monetary inputs/outputs are euros-integer
// unless explicitly labelled _cents. We always round the split result
// so net + vat == gross; never leak half-cents through the display.
//
// Behaviours:
//   vat=off        → gross unchanged, net=gross, vat=0
//   vat=inclusive  → gross contains the tax; net = round(gross/(1+r))
//   vat=exclusive  → gross is tax-free; grossOut = round(gross*(1+r))

import type { VatMode } from "./company";

export interface VatBreakdown {
  /** What the client effectively paid (tax-inclusive total). */
  gross: number;
  /** Amount before VAT. */
  net: number;
  /** Just the VAT portion. */
  vat: number;
  rate: number; // e.g. 19
  mode: VatMode;
}

export function splitVat(
  gross: number,
  mode: VatMode,
  ratePercent: number
): VatBreakdown {
  if (mode === "off" || ratePercent <= 0) {
    return { gross, net: gross, vat: 0, rate: ratePercent, mode };
  }
  const r = ratePercent / 100;
  if (mode === "exclusive") {
    const vat = Math.round(gross * r);
    return {
      gross: gross + vat,
      net: gross,
      vat,
      rate: ratePercent,
      mode,
    };
  }
  // inclusive
  const net = Math.round(gross / (1 + r));
  const vat = gross - net;
  return { gross, net, vat, rate: ratePercent, mode };
}
