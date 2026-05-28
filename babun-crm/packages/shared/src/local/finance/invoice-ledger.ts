// DB-backed invoice types (the new server-issued, atomically-numbered
// invoice flow). Distinct from the existing local/finance/invoice.ts
// which is the legacy localStorage-era jsPDF generator — these are the
// authoritative records that live in the public.invoices table.

export type InvoiceStatus = "issued" | "paid" | "void";

export interface InvoiceLedger {
  id: string;
  tenant_id: string;
  number: string; // e.g. "INV-2026-001"
  year: number;
  seq: number;
  issued_on: string; // YYYY-MM-DD
  due_on: string | null;
  client_id: string | null;
  appointment_id: string | null;
  brigade_id: string | null;
  subtotal_net: number;
  vat_percent: number;
  vat_amount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InvoiceLineLedger {
  id: string;
  invoice_id: string;
  position: number;
  title: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface InvoiceLedgerWithLines extends InvoiceLedger {
  lines: InvoiceLineLedger[];
}

export function formatInvoiceNumber(
  prefix: string,
  year: number,
  seq: number,
): string {
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * Split a gross total into net + VAT. Cyprus standard is 19%. We treat
 * the input as the customer-facing total (VAT-inclusive) — the most
 * common case at the till.
 */
export function splitVatInclusive(
  total: number,
  vatPercent: number,
): { net: number; vat: number } {
  const factor = 1 + vatPercent / 100;
  const net = total / factor;
  return { net: round2(net), vat: round2(total - net) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
