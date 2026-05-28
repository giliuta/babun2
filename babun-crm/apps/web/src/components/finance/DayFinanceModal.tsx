"use client";

// Centered, 2-column day-finance modal (replaces DayFinanceDetailModal).
//
// Left = Доход (auto-derived income from completed/in-progress appointments
// + manual income lines). Right = Расход (material costs from completed
// appointments + manual expenses). Header shows net profit for the day.
// «+ Доход / + Расход» buttons expand an inline form below the columns
// — not a separate modal — for amount, category, payment method and
// (for expenses) an optional receipt photo uploaded to the private
// `receipts` bucket. Hard-delete per card; autosave on every mutation.

import { useEffect, useMemo, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import type { Appointment } from "@babun/shared/local/appointments";
import { getPaidAmount } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { getServiceMaterialCost } from "@babun/shared/local/services";
import type {
  DayExtra,
  DayExtraKind,
  DayExtraPaymentMethod,
  ExpenseCategoryKey,
} from "@babun/shared/local/day-extras";
import { generateId } from "@babun/shared/local/masters";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ORDER,
} from "@babun/shared/local/finance/expense-categories";
import { compressImage } from "@/lib/imageCompress";
import {
  uploadReceipt,
  getReceiptSignedUrl,
} from "@babun/shared/db/repositories/day-extra-receipts";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface DayFinanceModalProps {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  /** ВСЕ записи дня (любой статус). */
  appointments: Appointment[];
  services: Service[];
  clientNameFor: (apt: Appointment) => string;
  extras: DayExtra[];
  tenantId: string | null;
  /** Autosave — called on every add/remove of a manual entry. */
  onSave: (extras: DayExtra[]) => void;
}

const METHODS: Array<{ key: DayExtraPaymentMethod; label: string; emoji: string }> = [
  { key: "cash", label: "Наличные", emoji: "💵" },
  { key: "card", label: "Карта", emoji: "💳" },
  { key: "transfer", label: "Перевод", emoji: "🏦" },
  { key: "other", label: "Иное", emoji: "📦" },
];

export default function DayFinanceModal({
  open,
  onClose,
  dateLabel,
  appointments,
  services,
  clientNameFor,
  extras,
  tenantId,
  onSave,
}: DayFinanceModalProps) {
  const [localExtras, setLocalExtras] = useState<DayExtra[]>(extras);
  const [addKind, setAddKind] = useState<DayExtraKind | null>(null);

  useEffect(() => {
    if (open) {
      setLocalExtras(extras);
      setAddKind(null);
    }
  }, [open, extras]);

  const closable = useMemo(
    () => appointments.filter((a) => a.status === "completed" || a.status === "in_progress"),
    [appointments],
  );

  const serviceById = useMemo(
    () => new Map(services.map((s) => [s.id, s] as const)),
    [services],
  );

  const apptIncome = useMemo(
    () => closable.reduce((sum, a) => sum + getPaidAmount(a), 0),
    [closable],
  );

  const apptMaterials = useMemo(
    () =>
      closable.reduce((sum, a) => {
        return (
          sum +
          a.service_ids.reduce((c, sid) => {
            const s = serviceById.get(sid);
            return c + (s ? getServiceMaterialCost(s) : 0);
          }, 0)
        );
      }, 0),
    [closable, serviceById],
  );

  const manualIncome = localExtras.filter((e) => e.kind === "income");
  const manualExpense = localExtras.filter((e) => e.kind === "expense");
  const manualIncomeSum = manualIncome.reduce((s, e) => s + e.amount, 0);
  const manualExpenseSum = manualExpense.reduce((s, e) => s + e.amount, 0);

  const incomeTotal = apptIncome + manualIncomeSum;
  const expenseTotal = apptMaterials + manualExpenseSum;
  const netProfit = incomeTotal - expenseTotal;

  const commit = (next: DayExtra[]) => {
    setLocalExtras(next);
    onSave(next);
  };

  const handleAdd = (entry: DayExtra) => {
    commit([...localExtras, entry]);
    setAddKind(null);
  };

  const handleRemove = (id: string) => {
    commit(localExtras.filter((e) => e.id !== id));
  };

  return (
    <DialogModal open={open} onClose={onClose} title={`Финансы · ${dateLabel}`}>
      <div className="px-4 pt-3 pb-2">
        <div className="text-[12px] uppercase tracking-wide text-[var(--label-tertiary)]">
          Чистая прибыль
        </div>
        <div
          className={`text-[28px] font-bold tabular-nums leading-tight ${
            netProfit < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
          }`}
        >
          {formatEUR(netProfit)}
        </div>
      </div>

      <div className="flex border-t border-[var(--separator)] divide-x divide-[var(--separator)]">
        <ColumnHeader
          tone="income"
          label="Доход"
          sum={incomeTotal}
          onAdd={() => setAddKind("income")}
        />
        <ColumnHeader
          tone="expense"
          label="Расход"
          sum={expenseTotal}
          onAdd={() => setAddKind("expense")}
        />
      </div>

      <div className="flex divide-x divide-[var(--separator)]">
        <div className="flex-1 min-w-0 px-2 py-1.5 space-y-1.5">
          {closable.map((apt) => (
            <IncomeApptCard
              key={apt.id}
              apt={apt}
              name={clientNameFor(apt)}
              services={apt.services
                .map((s) => serviceById.get(s.serviceId)?.name)
                .filter(Boolean)
                .join(", ")}
            />
          ))}
          {manualIncome.map((e) => (
            <ExtraCard key={e.id} extra={e} onRemove={() => handleRemove(e.id)} />
          ))}
          {closable.length === 0 && manualIncome.length === 0 && (
            <EmptyHint />
          )}
        </div>
        <div className="flex-1 min-w-0 px-2 py-1.5 space-y-1.5">
          {apptMaterials > 0 && (
            <div className="rounded-[10px] bg-[var(--fill-tertiary)] px-2.5 py-2">
              <div className="text-[12px] text-[var(--label)]">Материалы</div>
              <div className="text-[11px] text-[var(--label-tertiary)] mt-0.5">
                По выполненным записям
              </div>
              <div className="text-[13px] font-semibold tabular-nums text-[var(--system-red)] mt-1">
                −{formatEUR(apptMaterials)}
              </div>
            </div>
          )}
          {manualExpense.map((e) => (
            <ExtraCard key={e.id} extra={e} onRemove={() => handleRemove(e.id)} />
          ))}
          {apptMaterials === 0 && manualExpense.length === 0 && <EmptyHint />}
        </div>
      </div>

      {addKind && (
        <AddTransactionForm
          kind={addKind}
          tenantId={tenantId}
          onCancel={() => setAddKind(null)}
          onAdd={handleAdd}
        />
      )}
    </DialogModal>
  );
}

function ColumnHeader({
  tone,
  label,
  sum,
  onAdd,
}: {
  tone: "income" | "expense";
  label: string;
  sum: number;
  onAdd: () => void;
}) {
  const color =
    tone === "income" ? "text-[var(--system-green)]" : "text-[var(--system-red)]";
  return (
    <div className="flex-1 min-w-0 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${color}`}>
          {label}
        </span>
        <span className={`text-[14px] font-bold tabular-nums ${color}`}>
          {tone === "income" ? "+" : "−"}
          {formatEUR(sum)}
        </span>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className={`mt-1.5 w-full h-7 rounded-[8px] border border-dashed text-[12px] font-medium active:scale-[0.98] ${
          tone === "income"
            ? "border-[var(--system-green)]/50 text-[var(--system-green)]"
            : "border-[var(--system-red)]/50 text-[var(--system-red)]"
        }`}
      >
        + {tone === "income" ? "Доход" : "Расход"}
      </button>
    </div>
  );
}

function IncomeApptCard({
  apt,
  name,
  services,
}: {
  apt: Appointment;
  name: string;
  services: string;
}) {
  const paid = getPaidAmount(apt);
  const methodEmoji =
    apt.payment_method === "cash"
      ? "💵"
      : apt.payment_method === "card"
        ? "💳"
        : apt.payment_method === "transfer"
          ? "🏦"
          : null;
  return (
    <div className="rounded-[10px] bg-[var(--fill-tertiary)] px-2.5 py-2">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[12px] text-[var(--label)] truncate flex-1">{name}</span>
        <span className="text-[11px] text-[var(--label-tertiary)] tabular-nums flex-shrink-0">
          {apt.time_start}
        </span>
      </div>
      {services && (
        <div className="text-[11px] text-[var(--label-tertiary)] truncate mt-0.5">
          {services}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[12px]">{methodEmoji ?? ""}</span>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--system-green)]">
          +{formatEUR(paid)}
        </span>
      </div>
    </div>
  );
}

function ExtraCard({ extra, onRemove }: { extra: DayExtra; onRemove: () => void }) {
  const isIncome = extra.kind === "income";
  const cat = extra.category ? EXPENSE_CATEGORIES[extra.category] : null;
  const methodEmoji = METHODS.find((m) => m.key === extra.payment_method)?.emoji ?? null;
  return (
    <div className="rounded-[10px] bg-[var(--fill-tertiary)] px-2.5 py-2 relative group">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[12px] text-[var(--label)] truncate flex-1">
          {cat ? `${cat.emoji} ` : ""}
          {extra.name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Удалить"
          className="text-[var(--label-tertiary)] active:text-[var(--system-red)] text-[14px] leading-none px-1"
        >
          ×
        </button>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[12px]">{methodEmoji ?? ""}</span>
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            isIncome ? "text-[var(--system-green)]" : "text-[var(--system-red)]"
          }`}
        >
          {isIncome ? "+" : "−"}
          {formatEUR(extra.amount)}
        </span>
      </div>
      {extra.receipt_url && (
        <ReceiptPreview path={extra.receipt_url} />
      )}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="px-2 py-3 text-[11px] text-[var(--label-tertiary)] text-center">
      Пусто
    </div>
  );
}

function ReceiptPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getReceiptSignedUrl(getSupabaseBrowser(), path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Чек"
      className="mt-1.5 w-full max-h-[80px] object-cover rounded-[6px]"
    />
  );
}

function AddTransactionForm({
  kind,
  tenantId,
  onCancel,
  onAdd,
}: {
  kind: DayExtraKind;
  tenantId: string | null;
  onCancel: () => void;
  onAdd: (entry: DayExtra) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryKey>("other");
  const [method, setMethod] = useState<DayExtraPaymentMethod>("cash");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);
  const canSave = name.trim().length > 0 && numericAmount > 0;

  const handleReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const extraId = generateId("xtra");
      // Reuse extraId as the path-key so a future save links to the same blob.
      // We stash both via state below so the resulting DayExtra carries them.
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

  const handleSave = () => {
    if (!canSave) return;
    const entry: DayExtra = {
      id: generateId("xtra"),
      name: name.trim(),
      amount: numericAmount,
      kind,
      payment_method: method,
      ...(kind === "expense" ? { category } : {}),
      ...(receiptPath ? { receipt_url: receiptPath } : {}),
    };
    onAdd(entry);
  };

  return (
    <div className="border-t border-[var(--separator)] bg-[var(--fill-tertiary)] px-3 py-3 space-y-2">
      <div className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wide">
        {kind === "income" ? "Новый доход" : "Новый расход"}
      </div>

      {kind === "expense" && (
        <div className="flex gap-1.5 overflow-x-auto">
          {EXPENSE_CATEGORY_ORDER.map((k) => {
            const c = EXPENSE_CATEGORIES[k];
            const active = category === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                className={`flex-shrink-0 h-8 px-2.5 rounded-full text-[12px] font-medium border transition ${
                  active
                    ? "bg-[var(--system-red)] text-[var(--label-on-accent)] border-transparent"
                    : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto">
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={`flex-shrink-0 h-8 px-2.5 rounded-full text-[12px] font-medium border transition ${
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

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "income" ? "Например, чаевые" : "Например, фильтр для AC"}
          className="flex-1 h-10 px-3 bg-[var(--surface-card)] rounded-[10px] text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <div className="flex items-center bg-[var(--surface-card)] rounded-[10px] px-3 w-[110px]">
          <span className="text-[13px] text-[var(--label-secondary)]">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 ml-1 h-10 bg-transparent text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none tabular-nums"
          />
        </div>
      </div>

      {kind === "expense" && (
        <div>
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
              {uploading ? "Загрузка…" : receiptPath ? "Чек прикреплён · заменить" : "Прикрепить чек"}
            </span>
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 text-[13px] text-[var(--label-secondary)] font-medium"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`flex-1 h-9 rounded-[var(--radius-pill)] text-[13px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] ${
            kind === "income"
              ? "bg-[var(--system-green)] text-[var(--label-on-accent)]"
              : "bg-[var(--system-red)] text-[var(--label-on-accent)]"
          }`}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
