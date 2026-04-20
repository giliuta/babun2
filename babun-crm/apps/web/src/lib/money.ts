// EUR formatting helpers — one place so every page renders money the
// same way.
//
// Cyprus uses the Eurozone convention: € sign BEFORE the number, space
// separator for thousands (narrow no-break space so digits don't line
// break mid-number). Negatives get a unicode minus (−), not a hyphen.

const NB = "\u00A0"; // narrow no-break space for thousands separator

export function formatEUR(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const grouped = abs
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return rounded < 0 ? `−€${grouped}` : `€${grouped}`;
}

/**
 * Format a cents-integer as euros. Use this at every boundary where the
 * stored value is `amountCents` (FinancePayment, Expense, PayrollLine)
 * — feeding cents into `formatEUR` directly renders €X 100× too big
 * and has shipped silently on /expenses, /payroll, /brigades (#B2 of
 * Sprint 011).
 */
export function formatEURFromCents(cents: number): string {
  return formatEUR(Math.round(cents / 100));
}

export function formatEURSignedFromCents(cents: number): string {
  return formatEURSigned(Math.round(cents / 100));
}

/**
 * Same as formatEUR but with an explicit leading sign. Useful for
 * "delta" displays where we want a + shown even for positive values.
 */
export function formatEURSigned(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "€0";
  const body = formatEUR(Math.abs(rounded));
  return rounded > 0 ? `+${body}` : `−${body}`;
}

export function formatPercentDelta(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const r = Math.round(pct);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${r}%`;
}
