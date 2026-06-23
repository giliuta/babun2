"use client";

// Centered popup that issues an invoice for an existing income tx.
// MVP: single line auto-populated from the tx (amount + a free-form
// title). VAT defaulted to 19% inclusive. Server route handles atomic
// numbering. PDF generation lands in a later phase.

import { useEffect, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import { splitVatInclusive } from "@babun/shared/local/finance/invoice-ledger";
import { loadCompany } from "@babun/shared/local/finance/company";
import {
  generateLedgerInvoicePDF,
  type LedgerInvoicePdfLine,
} from "@babun/shared/local/finance/ledger-invoice-pdf";
import { downloadBlob } from "@babun/shared/local/finance/invoice";

interface InvoiceSheetProps {
  open: boolean;
  onClose: () => void;
  transaction: FinanceTransaction;
  /** Resolved client name for the PDF "Bill to" block. */
  clientName?: string | null;
  onIssued: (invoice: { id: string; number: string; pdf_url: string | null }) => void;
}

interface IssuedInvoice {
  number: string;
  lines: LedgerInvoicePdfLine[];
  net: number;
  vat: number;
  total: number;
  vatPercent: number;
  issuedOn: string;
  dueOn: string | null;
  notes: string | null;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InvoiceSheet({
  open,
  onClose,
  transaction,
  clientName,
  onIssued,
}: InvoiceSheetProps) {
  const [title, setTitle] = useState("Услуги");
  const [grossAmount, setGrossAmount] = useState(String(transaction.amount));
  const [vatPercent, setVatPercent] = useState("19");
  const [vatInclusive, setVatInclusive] = useState(true);
  const [issuedOn, setIssuedOn] = useState(transaction.occurred_on || todayYmd());
  const [dueOn, setDueOn] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedInvoice | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(transaction.notes || "Услуги");
      setGrossAmount(String(Math.abs(transaction.amount)));
      setVatPercent("19");
      setVatInclusive(true);
      setIssuedOn(transaction.occurred_on || todayYmd());
      setDueOn("");
      setNotes("");
      setSubmitting(false);
      setError(null);
      setIssued(null);
    }
  }, [open, transaction]);

  const gross = parseFloat(grossAmount.replace(",", ".")) || 0;
  const vatRate = parseFloat(vatPercent.replace(",", ".")) || 0;
  const { net, vat } = vatInclusive
    ? splitVatInclusive(gross, vatRate)
    : { net: gross, vat: Math.round(gross * (vatRate / 100) * 100) / 100 };
  const total = vatInclusive ? gross : Math.round((net + vat) * 100) / 100;

  const canSubmit = gross > 0 && title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/invoices/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: transaction.client_id,
          appointment_id: transaction.appointment_id,
          brigade_id: transaction.team_id,
          issued_on: issuedOn,
          due_on: dueOn || null,
          vat_percent: vatRate,
          vat_inclusive: vatInclusive,
          lines: [
            { title: title.trim(), qty: 1, unit_price: vatInclusive ? gross : net },
          ],
          notes: notes.trim() || null,
          link_to_tx_id: transaction.id,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as {
        invoice: { id: string; number: string; pdf_url: string | null };
      };
      onIssued(data.invoice);
      setIssued({
        number: data.invoice.number,
        lines: [
          {
            title: title.trim(),
            qty: 1,
            unit_price: net,
            total: net,
          },
        ],
        net,
        vat,
        total,
        vatPercent: vatRate,
        issuedOn,
        dueOn: dueOn || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!issued) return;
    const { blob, filename } = generateLedgerInvoicePDF({
      kind: "invoice",
      number: issued.number,
      issued_on: issued.issuedOn,
      due_on: issued.dueOn,
      currency: "EUR",
      subtotal_net: issued.net,
      vat_percent: issued.vatPercent,
      vat_amount: issued.vat,
      total: issued.total,
      notes: issued.notes,
      lines: issued.lines,
      company: loadCompany(),
      clientName,
    });
    downloadBlob(blob, filename);
  };

  if (!open) return null;

  if (issued) {
    return (
      <DialogModal
        open={open}
        onClose={onClose}
        title="Инвойс выставлен"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 h-12 rounded-[var(--radius-pill)] font-semibold text-[14px] bg-[var(--accent)] text-[var(--label-on-accent)] active:scale-[0.98] transition"
            >
              Скачать PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-[var(--radius-pill)] font-semibold text-[14px] text-[var(--label-secondary)] border border-[var(--separator)] active:scale-[0.98] transition"
            >
              Готово
            </button>
          </div>
        }
      >
        <div className="px-4 py-5 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--system-green)]/15 flex items-center justify-center text-[28px]">
            ✓
          </div>
          <div className="text-[17px] font-semibold text-[var(--label)]">
            {issued.number}
          </div>
          <div className="text-[28px] font-bold tabular-nums text-[var(--label)]">
            {formatEUR(issued.total)}
          </div>
          <p className="text-[12px] text-[var(--label-tertiary)] leading-relaxed px-2">
            Документ готов. «Скачать PDF» — чтобы сохранить или отправить
            клиенту. Реквизиты компании берутся из Настроек → Финансы →
            Реквизиты и НДС.
          </p>
        </div>
      </DialogModal>
    );
  }

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Выставить инвойс"
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-12 rounded-[var(--radius-pill)] font-semibold text-[14px] active:scale-[0.98] transition disabled:opacity-50 bg-[var(--accent)] text-[var(--label-on-accent)]"
        >
          {submitting ? "Выставляю…" : `Выставить · ${formatEUR(total)}`}
        </button>
      }
    >
      <div className="px-3 py-3 space-y-3">
        <Field label="Описание услуги" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Услуги по записи"
            className={inputCls}
            autoFocus
          />
        </Field>

        <Field label="Сумма" required>
          <div className="flex items-center bg-[var(--fill-tertiary)] rounded-[10px] px-3 h-11">
            <span className="text-[15px] text-[var(--label-secondary)]">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={grossAmount}
              onChange={(e) => setGrossAmount(e.target.value)}
              className="flex-1 ml-1 h-11 bg-transparent text-[15px] text-[var(--label)] focus:outline-none tabular-nums"
            />
          </div>
        </Field>

        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="VAT, %">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Режим VAT">
              <select
                value={vatInclusive ? "inc" : "exc"}
                onChange={(e) => setVatInclusive(e.target.value === "inc")}
                className={inputCls}
              >
                <option value="inc">включён в сумму</option>
                <option value="exc">добавляется сверху</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="bg-[var(--fill-tertiary)] rounded-[10px] px-3 py-2 text-[13px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-[var(--label-secondary)]">Без VAT</span>
            <span>{formatEUR(net)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--label-secondary)]">VAT {vatRate}%</span>
            <span>{formatEUR(vat)}</span>
          </div>
          <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-[var(--separator)]">
            <span>Итого</span>
            <span>{formatEUR(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Дата">
              <input
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Срок оплаты">
              <input
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <Field label="Примечание">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Например, оплата до 15 числа"
            className={inputCls}
          />
        </Field>

        {error && (
          <div className="text-[12px] text-[var(--system-red)]">
            Ошибка: {error}
          </div>
        )}
      </div>
    </DialogModal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1 tracking-wide">
        {label}
        {required && <span className="text-[var(--system-red)] ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";
