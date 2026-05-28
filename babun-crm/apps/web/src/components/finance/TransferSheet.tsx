"use client";

// Centered popup for +Перевод. From-account → to-account + amount +
// optional note. Backed by createTransfer which writes a pair of
// transfer-type rows sharing the same transfer_group_id.

import { useEffect, useMemo, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account } from "@babun/shared/local/finance/account";
import type { TransferDraft } from "@babun/shared/db/repositories/finance-transactions";
import type { Team } from "@babun/shared/local/masters";

interface TransferSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  teams: Team[];
  onSubmit: (draft: TransferDraft) => Promise<void>;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TransferSheet({
  open,
  onClose,
  accounts,
  teams,
  onSubmit,
}: TransferSheetProps) {
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFromId(accounts[0]?.id ?? "");
      setToId(accounts[1]?.id ?? "");
      setAmount("");
      setDate(todayYmd());
      setNotes("");
      setSubmitting(false);
    }
  }, [open, accounts]);

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);

  const canSave =
    numericAmount > 0 && fromId !== "" && toId !== "" && fromId !== toId;

  const teamName = (brigadeId: string) =>
    teams.find((t) => t.id === brigadeId)?.name ?? brigadeId;

  const handleSave = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    try {
      const fromAccount = accounts.find((a) => a.id === fromId);
      await onSubmit({
        from_account_id: fromId,
        to_account_id: toId,
        amount: numericAmount,
        occurred_on: date,
        notes: notes.trim() || null,
        brigade_id: fromAccount?.brigade_id ?? null,
      });
      onClose();
    } catch (err) {
      console.error("createTransfer failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Новый перевод"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || submitting}
          className="w-full h-12 rounded-[var(--radius-pill)] font-semibold text-[14px] active:scale-[0.98] transition disabled:opacity-50 bg-[var(--accent)] text-[var(--label-on-accent)]"
        >
          {submitting ? "Сохраняю…" : `Перевести ${formatEUR(numericAmount || 0)}`}
        </button>
      }
    >
      <div className="px-3 py-3 space-y-3">
        <Field label="Откуда" required>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className={inputCls}
          >
            <option value="">— выбрать —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon ?? "💵"} {a.name} · {teamName(a.brigade_id)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Куда" required>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className={inputCls}
          >
            <option value="">— выбрать —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.id === fromId}>
                {a.icon ?? "💵"} {a.name} · {teamName(a.brigade_id)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Сумма" required>
          <div className="flex items-center bg-[var(--fill-tertiary)] rounded-[10px] px-3 h-11">
            <span className="text-[15px] text-[var(--label-secondary)]">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="flex-1 ml-1 h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none tabular-nums"
            />
          </div>
        </Field>

        <Field label="Дата">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Примечание">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Например, инкассация"
            className={inputCls}
          />
        </Field>

        {fromId !== "" && toId === fromId && (
          <div className="text-[12px] text-[var(--system-red)]">
            Счёт-источник и счёт-получатель должны быть разными.
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
