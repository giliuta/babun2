"use client";

// Centered popup for +Доход / +Расход. Chip-row of templates on top,
// then category, payment method, brigade/account, amount, note, and
// — for expenses — an optional receipt photo (uploaded to the
// `receipts` bucket, compressed on the client).

import { useEffect, useMemo, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account } from "@babun/shared/local/finance/account";
import type {
  PaymentMethod,
} from "@babun/shared/local/finance/transaction";
import type { FinanceTemplate } from "@babun/shared/local/finance/template";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import type { TransactionDraft } from "@babun/shared/db/repositories/finance-transactions";
import type { Team } from "@babun/shared/local/masters";
import { compressImage } from "@/lib/imageCompress";
import { uploadReceipt } from "@babun/shared/db/repositories/day-extra-receipts";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  kind: "income" | "expense";
  tenantId: string;
  accounts: Account[];
  teams: Team[];
  categories: FinanceCategory[];
  templates: FinanceTemplate[];
  /** Default brigade selection. Empty = ask user to pick. */
  defaultBrigadeId?: string;
  onSubmit: (draft: TransactionDraft) => Promise<void>;
}

const METHODS: Array<{ key: PaymentMethod; label: string; emoji: string }> = [
  { key: "cash", label: "Наличные", emoji: "💵" },
  { key: "card", label: "Карта", emoji: "💳" },
  { key: "transfer", label: "Перевод", emoji: "🏦" },
  { key: "other", label: "Иное", emoji: "📦" },
];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddTransactionSheet({
  open,
  onClose,
  kind,
  tenantId,
  accounts,
  teams,
  categories,
  templates,
  defaultBrigadeId,
  onSubmit,
}: AddTransactionSheetProps) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [brigadeId, setBrigadeId] = useState<string>(defaultBrigadeId ?? "");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmount("");
      setName("");
      setCategoryId(null);
      setMethod("cash");
      setBrigadeId(defaultBrigadeId ?? "");
      setAccountId(null);
      setDate(todayYmd());
      setReceiptPath(null);
      setSubmitting(false);
    }
  }, [open, defaultBrigadeId]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === kind),
    [categories, kind],
  );

  const visibleAccounts = useMemo(
    () => (brigadeId ? accounts.filter((a) => a.brigade_id === brigadeId) : accounts),
    [accounts, brigadeId],
  );

  const visibleTemplates = useMemo(
    () => templates.filter((t) => t.kind === kind),
    [templates, kind],
  );

  // Auto-pick first available account when brigade changes.
  useEffect(() => {
    if (visibleAccounts.length > 0 && !visibleAccounts.find((a) => a.id === accountId)) {
      setAccountId(visibleAccounts[0].id);
    }
  }, [visibleAccounts, accountId]);

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);
  const canSave = numericAmount > 0 && brigadeId !== "";

  const applyTemplate = (t: FinanceTemplate) => {
    setAmount(String(t.amount));
    setName(t.name);
    if (t.category_id) setCategoryId(t.category_id);
    if (t.payment_method) setMethod(t.payment_method);
    if (t.brigade_id) setBrigadeId(t.brigade_id);
    if (t.account_id) setAccountId(t.account_id);
  };

  const handleReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const extraId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tx-${Date.now()}`;
      const path = await uploadReceipt(getSupabaseBrowser(), {
        tenantId,
        extraId,
        file: blob,
        fileName: file.name,
      });
      setReceiptPath(path);
    } catch (err) {
      console.error("uploadReceipt failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    try {
      const draft: TransactionDraft = {
        type: kind,
        amount: numericAmount,
        category_id: categoryId,
        account_id: accountId,
        team_id: brigadeId || null,
        payment_method: method,
        notes: name.trim() || null,
        occurred_on: date,
        receipt_url: receiptPath,
      };
      await onSubmit(draft);
      onClose();
    } catch (err) {
      console.error("addTransaction failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={kind === "income" ? "Новый доход" : "Новый расход"}
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || submitting}
          className={`w-full h-12 rounded-[var(--radius-pill)] font-semibold text-[14px] active:scale-[0.98] transition disabled:opacity-50 ${
            kind === "income"
              ? "bg-[var(--system-green)] text-[var(--label-on-accent)]"
              : "bg-[var(--system-red)] text-[var(--label-on-accent)]"
          }`}
        >
          {submitting ? "Сохраняю…" : `Сохранить ${formatEUR(numericAmount || 0)}`}
        </button>
      }
    >
      <div className="px-3 py-3 space-y-3">
        {visibleTemplates.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
            {visibleTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border border-[var(--separator)] bg-[var(--surface-card)] text-[var(--label)] active:scale-[0.98]"
              >
                {t.name} · {formatEUR(t.amount)}
              </button>
            ))}
          </div>
        )}

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

        <Field label="Описание">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "income" ? "Чаевые, продажа, ..." : "Заправка, материалы, ..."}
            className={inputCls}
          />
        </Field>

        <Field label="Бригада" required>
          <select
            value={brigadeId}
            onChange={(e) => setBrigadeId(e.target.value)}
            className={inputCls}
          >
            <option value="">— выбрать —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Счёт">
          <select
            value={accountId ?? ""}
            onChange={(e) => setAccountId(e.target.value || null)}
            disabled={visibleAccounts.length === 0}
            className={inputCls}
          >
            {visibleAccounts.length === 0 && <option value="">— нет счетов —</option>}
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon ?? "💵"} {a.name}
              </option>
            ))}
          </select>
        </Field>

        {visibleCategories.length > 0 && (
          <Field label="Категория">
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
              {visibleCategories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-medium border transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent"
                        : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
                    }`}
                  >
                    {c.icon ?? "•"} {c.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Способ оплаты">
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-medium border transition-colors ${
                    active
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent"
                      : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              );
            })}
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

        {kind === "expense" && (
          <Field label="Чек">
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--accent)] cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptPick}
                disabled={!tenantId || uploading}
              />
              <span className="underline-offset-2 hover:underline">
                {uploading ? "Загрузка…" : receiptPath ? "Чек прикреплён · заменить" : "Прикрепить фото чека"}
              </span>
            </label>
          </Field>
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
