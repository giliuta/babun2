// POST /api/invoices/issue
//
// Issues a new invoice with atomic per-(tenant, year) sequence numbering.
// The unique constraint on (tenant_id, year, seq) is the source of
// truth — we read the current max(seq), insert seq+1, and retry on
// constraint violation (race between two concurrent issuances).
//
// Body shape:
//   {
//     client_id?:       uuid | null,
//     appointment_id?:  uuid | null,
//     brigade_id?:      string | null,
//     issued_on?:       "YYYY-MM-DD",   // defaults to today
//     due_on?:          "YYYY-MM-DD" | null,
//     vat_percent?:     number,         // defaults to 19
//     vat_inclusive?:   boolean,        // default true — gross totals
//     lines: [{ title, qty, unit_price }],
//     notes?:           string | null,
//     link_to_tx_id?:   uuid | null     // if set: set finance_transactions.invoice_id
//   }
//
// Returns: { invoice, lines }. The PDF is generated and uploaded in
// a separate phase (see Phase F).

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/http/csrf";
import { splitVatInclusive } from "@babun/shared/local/finance/invoice-ledger";

interface LineDraft {
  title: string;
  qty: number;
  unit_price: number;
}

interface Body {
  client_id?: string | null;
  appointment_id?: string | null;
  brigade_id?: string | null;
  issued_on?: string;
  due_on?: string | null;
  vat_percent?: number;
  vat_inclusive?: boolean;
  lines?: LineDraft[];
  notes?: string | null;
  link_to_tx_id?: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await getSupabaseServer();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant missing" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "Lines required" }, { status: 400 });
  }
  for (const l of lines) {
    if (!l || typeof l.title !== "string" || !l.title.trim()) {
      return NextResponse.json({ error: "Each line needs a title" }, { status: 400 });
    }
    if (typeof l.qty !== "number" || l.qty <= 0) {
      return NextResponse.json({ error: "Each line needs qty > 0" }, { status: 400 });
    }
    if (typeof l.unit_price !== "number" || l.unit_price < 0) {
      return NextResponse.json({ error: "Each line needs unit_price >= 0" }, { status: 400 });
    }
  }

  const vatPercent = typeof body.vat_percent === "number" ? body.vat_percent : 19;
  const issuedOn = body.issued_on ?? new Date().toISOString().slice(0, 10);
  const year = parseInt(issuedOn.slice(0, 4), 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Bad issued_on" }, { status: 400 });
  }

  // Compute totals.
  const grossTotal = round2(
    lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0),
  );
  const inclusive = body.vat_inclusive !== false; // default true
  const { net, vat } = inclusive
    ? splitVatInclusive(grossTotal, vatPercent)
    : { net: grossTotal, vat: round2(grossTotal * (vatPercent / 100)) };
  const total = inclusive ? grossTotal : round2(net + vat);

  // Tenant invoice prefix.
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .select("invoice_prefix")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) {
    return NextResponse.json({ error: tenantErr.message }, { status: 500 });
  }
  const prefix = tenantRow?.invoice_prefix ?? "INV";

  // Atomic numbering: read max(seq) and INSERT with seq+1, retry on conflict.
  const MAX_RETRIES = 5;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const { data: maxRow, error: maxErr } = await supabase
      .from("invoices")
      .select("seq")
      .eq("tenant_id", tenantId)
      .eq("year", year)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      lastErr = maxErr.message;
      break;
    }
    const seq = (maxRow?.seq ?? 0) + 1;
    const number = `${prefix}-${year}-${String(seq).padStart(3, "0")}`;

    const { data: invoice, error: insErr } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        number,
        year,
        seq,
        issued_on: issuedOn,
        due_on: body.due_on ?? null,
        client_id: body.client_id ?? null,
        appointment_id: body.appointment_id ?? null,
        brigade_id: body.brigade_id ?? null,
        subtotal_net: net,
        vat_percent: vatPercent,
        vat_amount: vat,
        total,
        currency: "EUR",
        status: "issued",
        notes: body.notes ?? null,
      })
      .select("*")
      .single();

    if (insErr) {
      // 23505 = unique_violation — another issuance grabbed our seq;
      // loop and try the next number.
      if ((insErr as { code?: string }).code === "23505") {
        lastErr = insErr.message;
        continue;
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Lines.
    const lineRows = lines.map((l, idx) => ({
      invoice_id: invoice.id,
      position: idx,
      title: l.title.trim(),
      qty: l.qty,
      unit_price: l.unit_price,
      total: round2(l.qty * l.unit_price),
    }));
    const { data: insertedLines, error: linesErr } = await supabase
      .from("invoice_lines")
      .insert(lineRows)
      .select("*");
    if (linesErr) {
      // Best-effort cleanup so we don't leave a header without lines.
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json({ error: linesErr.message }, { status: 500 });
    }

    // Optional link back to a finance_transactions row.
    if (body.link_to_tx_id) {
      await supabase
        .from("finance_transactions")
        .update({ invoice_id: invoice.id })
        .eq("id", body.link_to_tx_id)
        .eq("tenant_id", tenantId);
    }

    return NextResponse.json({ invoice, lines: insertedLines });
  }

  return NextResponse.json(
    { error: `Could not issue invoice after retries: ${lastErr ?? "unknown"}` },
    { status: 500 },
  );
}
