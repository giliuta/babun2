"use client";

// STORY-052 G5 — billing history (last 50 invoice events).
// Tenant-scoped read on billing_events filtered to invoice.payment_*
// event types. Each row shows date + amount + status; clicking the
// invoice URL opens Stripe's hosted invoice page in a new tab.

import type { BillingEventRow } from "./types";

interface Props {
  rows: BillingEventRow[];
}

export default function BillingHistoryTable({ rows }: Props) {
  return (
    <section className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-3">
      <header>
        <h2 className="text-[17px] font-semibold text-[var(--label)]">
          История платежей
        </h2>
        {rows.length === 0 && (
          <p className="text-[13px] text-[var(--label-secondary)] mt-1">
            Платежей пока не было.
          </p>
        )}
      </header>
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ row }: { row: BillingEventRow }) {
  const ok = row.event_type === "invoice.payment_succeeded";
  const tone = ok
    ? "bg-[var(--system-green,#34C759)]/15 text-[var(--system-green,#34C759)]"
    : "bg-[var(--system-red,#FF3B30)]/15 text-[var(--system-red,#FF3B30)]";
  const label = ok ? "Оплачено" : "Не прошёл";
  const inner = (
    <div className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] bg-[var(--surface-card-secondary)] active:opacity-70 transition">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {row.amount_cents != null
            ? `${(row.amount_cents / 100).toFixed(2)} €`
            : "—"}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate">
          {formatDateTimeRu(row.processed_at)}
        </div>
      </div>
      <span
        className={`shrink-0 px-2 h-6 rounded-full text-[11px] font-semibold flex items-center ${tone}`}
      >
        {label}
      </span>
    </div>
  );

  if (row.invoice_url) {
    return (
      <a
        href={row.invoice_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

function formatDateTimeRu(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
