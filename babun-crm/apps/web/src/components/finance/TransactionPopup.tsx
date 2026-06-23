"use client";

// Centered popup shown when tapping a transaction in the feed.
// Read-only details + actions: Удалить (hard delete) and — for income —
// Возврат (creates a manual refund row tied via refund_of_id).

import { useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Account } from "@babun/shared/local/finance/account";
import type { Team } from "@babun/shared/local/masters";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";

interface TransactionPopupProps {
  open: boolean;
  onClose: () => void;
  transaction: FinanceTransaction | null;
  accounts: Account[];
  teams: Team[];
  categories: FinanceCategory[];
  /** Σ already-refunded for this income — caps the new refund. */
  alreadyRefunded?: number;
  onDelete: (tx: FinanceTransaction) => Promise<void>;
  onRefund: (tx: FinanceTransaction, amount: number) => Promise<void>;
  onInvoice?: (tx: FinanceTransaction) => void;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  other: "Иное",
};

const TYPE_LABEL: Record<string, string> = {
  income: "Поступление",
  expense: "Расход",
  refund: "Возврат",
  transfer: "Перевод",
};

export default function TransactionPopup({
  open,
  onClose,
  transaction,
  accounts,
  teams,
  categories,
  alreadyRefunded = 0,
  onDelete,
  onRefund,
  onInvoice,
}: TransactionPopupProps) {
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open || !transaction) return null;

  const account = accounts.find((a) => a.id === transaction.account_id);
  const team = teams.find((t) => t.id === transaction.team_id);
  const category = categories.find((c) => c.id === transaction.category_id);

  const tone =
    transaction.type === "income" || transaction.type === "refund"
      ? "text-[var(--system-green)]"
      : transaction.type === "expense"
        ? "text-[var(--system-red)]"
        : "text-[var(--label)]";

  const sign =
    transaction.type === "income" || (transaction.type === "transfer" && transaction.amount > 0)
      ? "+"
      : "−";

  const refundRemaining = Math.max(0, transaction.amount - alreadyRefunded);
  const canRefund =
    transaction.type === "income" && !showRefundForm && refundRemaining > 0;
  const canInvoice =
    transaction.type === "income" &&
    !transaction.invoice_id &&
    !!onInvoice &&
    !showRefundForm;

  const refundNum = parseFloat(refundAmount.replace(",", "."));
  const refundValid = Number.isFinite(refundNum) && refundNum > 0 && refundNum <= refundRemaining;

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete(transaction);
      onClose();
    } catch (err) {
      console.error("deleteTransaction failed", err);
    } finally {
      setBusy(false);
    }
  };

  const handleRefund = async () => {
    if (!refundValid || busy) return;
    setBusy(true);
    try {
      await onRefund(transaction, refundNum);
      onClose();
    } catch (err) {
      console.error("refundTransaction failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogModal open={open} onClose={onClose} title={TYPE_LABEL[transaction.type]}>
      <div className="px-4 py-3 space-y-3">
        {/* Headline amount */}
        <div className="text-center py-2">
          <div className={`text-[32px] font-bold tabular-nums leading-tight ${tone}`}>
            {sign}
            {formatEUR(Math.abs(transaction.amount))}
          </div>
          {transaction.notes && (
            <div className="text-[13px] text-[var(--label-secondary)] mt-1">
              {transaction.notes}
            </div>
          )}
        </div>

        {/* Meta rows */}
        <div className="bg-[var(--fill-tertiary)] rounded-[10px] divide-y divide-[var(--separator)] text-[13px]">
          <Row label="Дата" value={formatRuDate(transaction.occurred_on)} />
          {category && <Row label="Категория" value={`${category.icon ?? ""} ${category.name}`.trim()} />}
          {account && <Row label="Счёт" value={`${account.icon ?? "💵"} ${account.name}`} />}
          {team && <Row label="Бригада" value={team.name} />}
          {transaction.payment_method && (
            <Row
              label="Способ оплаты"
              value={METHOD_LABEL[transaction.payment_method] ?? transaction.payment_method}
            />
          )}
          {transaction.source === "auto" && (
            <Row label="Источник" value="Создано автоматически (из записи)" />
          )}
        </div>

        {/* Actions */}
        {!showRefundForm && (
          <div className="space-y-2 pt-1">
            {canInvoice && (
              <button
                type="button"
                onClick={() => onInvoice?.(transaction)}
                disabled={busy}
                className="w-full h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold bg-[var(--system-green)] text-[var(--label-on-accent)] active:scale-[0.98] disabled:opacity-50"
              >
                Выставить инвойс
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold text-[var(--system-red)] border border-[var(--system-red)]/40 active:scale-[0.98] disabled:opacity-50"
              >
                Удалить
              </button>
              {canRefund && (
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundForm(true);
                    setRefundAmount(String(refundRemaining));
                  }}
                  disabled={busy}
                  className="flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] active:scale-[0.98] disabled:opacity-50"
                >
                  Создать возврат
                </button>
              )}
            </div>
          </div>
        )}

        {showRefundForm && (
          <div className="space-y-2 pt-1">
            <div className="text-[12px] font-medium text-[var(--label-secondary)]">
              Сумма возврата (до {formatEUR(refundRemaining)})
            </div>
            <div className="flex items-center bg-[var(--fill-tertiary)] rounded-[10px] px-3 h-11">
              <span className="text-[15px] text-[var(--label-secondary)]">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={refundRemaining}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                autoFocus
                className="flex-1 ml-1 h-11 bg-transparent text-[15px] text-[var(--label)] focus:outline-none tabular-nums"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRefundForm(false)}
                disabled={busy}
                className="flex-1 h-10 text-[13px] text-[var(--label-secondary)] font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleRefund}
                disabled={!refundValid || busy}
                className="flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold bg-[var(--system-red)] text-[var(--label-on-accent)] disabled:opacity-50"
              >
                Возврат
              </button>
            </div>
          </div>
        )}
      </div>
    </DialogModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[var(--label-secondary)]">{label}</span>
      <span className="text-[var(--label)] font-medium text-right truncate ml-2">{value}</span>
    </div>
  );
}

const RU_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatRuDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}
