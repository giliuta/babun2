// Invoices repository — read side.
//
// Issuance is handled by the /api/invoices/issue route so the
// numbering can be atomic against the (tenant_id, year, seq) unique:
// the route inserts with seq = COALESCE(max(seq)+1, 1) in a single
// statement and retries on constraint violation. This module owns
// the read paths (list / get) and the simple status update (mark paid
// / void) — anything that doesn't touch the seq.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type {
  InvoiceLedger,
  InvoiceLedgerWithLines,
  InvoiceLineLedger,
  InvoiceStatus,
} from "../../local/finance/invoice-ledger";

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["invoices"]["Row"];
type LineRow = Database["public"]["Tables"]["invoice_lines"]["Row"];

function rowToInvoice(r: Row): InvoiceLedger {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    number: r.number,
    year: r.year,
    seq: r.seq,
    issued_on: r.issued_on,
    due_on: r.due_on,
    client_id: r.client_id,
    appointment_id: r.appointment_id,
    brigade_id: r.brigade_id,
    subtotal_net: Number(r.subtotal_net ?? 0),
    vat_percent: Number(r.vat_percent ?? 19),
    vat_amount: Number(r.vat_amount ?? 0),
    total: Number(r.total ?? 0),
    currency: r.currency,
    status: r.status as InvoiceStatus,
    pdf_url: r.pdf_url,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    created_by: r.created_by,
  };
}

function rowToLine(r: LineRow): InvoiceLineLedger {
  return {
    id: r.id,
    invoice_id: r.invoice_id,
    position: r.position,
    title: r.title,
    qty: Number(r.qty ?? 1),
    unit_price: Number(r.unit_price ?? 0),
    total: Number(r.total ?? 0),
  };
}

export async function listInvoices(
  supabase: DbSupabase,
  tenantId: string,
  opts: { limit?: number; clientId?: string } = {},
): Promise<InvoiceLedger[]> {
  let q = supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantId);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  q = q.order("year", { ascending: false }).order("seq", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`listInvoices: ${error.message}`);
  return ((data ?? []) as Row[]).map(rowToInvoice);
}

export async function getInvoice(
  supabase: DbSupabase,
  id: string,
): Promise<InvoiceLedgerWithLines | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getInvoice: ${error.message}`);
  if (!data) return null;
  const { data: lines, error: linesErr } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("position", { ascending: true });
  if (linesErr) throw new Error(`getInvoice (lines): ${linesErr.message}`);
  return {
    ...rowToInvoice(data as Row),
    lines: ((lines ?? []) as LineRow[]).map(rowToLine),
  };
}

export async function updateInvoiceStatus(
  supabase: DbSupabase,
  id: string,
  status: InvoiceStatus,
): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`updateInvoiceStatus: ${error.message}`);
}

export async function setInvoicePdfUrl(
  supabase: DbSupabase,
  id: string,
  pdfPath: string,
): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ pdf_url: pdfPath })
    .eq("id", id);
  if (error) throw new Error(`setInvoicePdfUrl: ${error.message}`);
}
