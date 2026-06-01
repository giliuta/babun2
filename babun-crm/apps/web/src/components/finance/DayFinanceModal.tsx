"use client";

// Bottom-sheet day-finance modal (replaces the centered DialogModal).
//
// Rises from the bottom with a drag handle. Left column = Доход
// (completed appointments + manual income). Right column = Расход
// (aggregated materials + manual expenses). Header is a compact
// «день · дата · метка» line over the day's net profit (red on
// negative). «+ Доход / + Расход» live at the bottom of each column;
// tapping one expands the inline add form (chip category for expenses,
// chip payment method, amount, description, optional receipt photo
// uploaded to the private `receipts` bucket). Autosave on every add /
// remove; hard delete via × on each card.

import { useEffect, useMemo, useState } from "react";
import { getDayNameShort } from "@babun/shared/common/utils/date-utils";
import type { Appointment } from "@babun/shared/local/appointments";
import { getPaidAmount, getDebtAmount } from "@babun/shared/local/appointments";
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
  dateKey: string; // YYYY-MM-DD
  cityLabel?: string;
  /** ВСЕ записи дня (любой статус). */
  appointments: Appointment[];
  services: Service[];
  clientNameFor: (apt: Appointment) => string;
  extras: DayExtra[];
  tenantId: string | null;
  /** Autosave — called on every add/remove of a manual entry. */
  onSave: (extras: DayExtra[]) => void;
  /** Открыть запись (из вкладки «Ожидается» — чтобы отметить оплату). */
  onOpenAppointment?: (apt: Appointment) => void;
}

const METHODS: Array<{ key: DayExtraPaymentMethod; label: string; emoji: string }> = [
  { key: "cash", label: "Наличные", emoji: "💵" },
  { key: "card", label: "Карта", emoji: "💳" },
  { key: "transfer", label: "Перевод", emoji: "🏦" },
  { key: "other", label: "Иное", emoji: "📦" },
];

const MONTHS_GENITIVE = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
];

function formatHeaderDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const day = getDayNameShort(d).toUpperCase();
  return `${day} · ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export default function DayFinanceModal({
  open,
  onClose,
  dateKey,
  cityLabel,
  appointments,
  services,
  clientNameFor,
  extras,
  tenantId,
  onSave,
  onOpenAppointment,
}: DayFinanceModalProps) {
  const [localExtras, setLocalExtras] = useState<DayExtra[]>(extras);
  const [addKind, setAddKind] = useState<DayExtraKind | null>(null);
  const [segment, setSegment] = useState<"income" | "expense" | "pending">(
    "income",
  );

  useEffect(() => {
    if (open) {
      setLocalExtras(extras);
      setAddKind(null);
      setSegment("income");
    }
  }, [open, extras]);

  const handleSegment = (s: "income" | "expense" | "pending") => {
    setSegment(s);
    setAddKind(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

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

  // «Ожидается» — неоплаченный остаток по не-отменённым записям дня.
  const pendingAppts = useMemo(
    () =>
      appointments.filter(
        (a) => a.status !== "cancelled" && getDebtAmount(a) > 0,
      ),
    [appointments],
  );
  const pendingTotal = useMemo(
    () => pendingAppts.reduce((s, a) => s + getDebtAmount(a), 0),
    [pendingAppts],
  );
  const billedTotal = incomeTotal + pendingTotal;
  const potential = netProfit + pendingTotal;

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-[var(--surface-overlay)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: ДЕНЬ · ДАТА · МЕТКА + understated day total. */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
            {formatHeaderDate(dateKey)}
            {cityLabel ? ` · ${cityLabel}` : ""}
          </div>
          <div className="mt-1.5 text-[13px] text-[var(--label-secondary)]">
            Итог дня{" "}
            <span
              className={`text-[15px] font-semibold tabular-nums ${
                netProfit < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
              }`}
            >
              {formatEUR(netProfit)}
            </span>
          </div>
          {pendingTotal > 0 && (
            <div className="mt-0.5 text-[11px] text-[var(--label-tertiary)] tabular-nums">
              оплачено {formatEUR(incomeTotal)} из {formatEUR(billedTotal)} ·
              потенциал {formatEUR(potential)}
            </div>
          )}
        </div>

        {/* Segmented control — switches the list below + the bottom action. */}
        <div className="flex-shrink-0 mx-3 mt-1 mb-1 flex gap-1 rounded-[12px] bg-[var(--fill-tertiary)] p-1">
          <SegmentButton
            label="Доход"
            sum={incomeTotal}
            tone="income"
            active={segment === "income"}
            onClick={() => handleSegment("income")}
          />
          <SegmentButton
            label="Расход"
            sum={expenseTotal}
            tone="expense"
            active={segment === "expense"}
            onClick={() => handleSegment("expense")}
          />
          <SegmentButton
            label="Ожид."
            sum={pendingTotal}
            tone="pending"
            active={segment === "pending"}
            onClick={() => handleSegment("pending")}
          />
        </div>

        {/* Scrollable list for the active segment + (optionally) add form. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5">
          {segment === "income" && (
            <>
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
              {closable.length === 0 && manualIncome.length === 0 && <EmptyHint />}
            </>
          )}

          {segment === "expense" && (
            <>
              {apptMaterials > 0 && (
                <div className="rounded-[10px] bg-[rgba(255,59,48,0.08)] px-2.5 py-2">
                  <div className="text-[12px] text-[var(--label)]">Материалы</div>
                  <div className="text-[11px] text-[var(--label-tertiary)] mt-0.5">
                    По выполненным записям
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums text-[var(--system-red)] mt-1 text-right">
                    −{formatEUR(apptMaterials)}
                  </div>
                </div>
              )}
              {manualExpense.map((e) => (
                <ExtraCard key={e.id} extra={e} onRemove={() => handleRemove(e.id)} />
              ))}
              {apptMaterials === 0 && manualExpense.length === 0 && <EmptyHint />}
            </>
          )}

          {segment === "pending" && (
            <>
              {pendingAppts.map((apt) => (
                <PendingApptCard
                  key={apt.id}
                  apt={apt}
                  name={clientNameFor(apt)}
                  onOpen={onOpenAppointment}
                />
              ))}
              {pendingAppts.length === 0 && (
                <EmptyHint text="Нет неоплаченных записей" />
              )}
            </>
          )}

          {addKind && (
            <AddTransactionForm
              kind={addKind}
              tenantId={tenantId}
              onCancel={() => setAddKind(null)}
              onAdd={handleAdd}
            />
          )}
        </div>

        {/* Bottom action — contextual to the active segment. */}
        {!addKind && (
          <div className="flex-shrink-0 px-3 py-3 border-t border-[var(--separator)]">
            {segment === "income" && (
              <button
                type="button"
                onClick={() => setAddKind("income")}
                className="w-full h-10 rounded-[12px] text-[13px] font-semibold bg-[var(--system-green)] text-[var(--label-on-accent)] active:scale-[0.98]"
              >
                + Доход
              </button>
            )}
            {segment === "expense" && (
              <button
                type="button"
                onClick={() => setAddKind("expense")}
                className="w-full h-10 rounded-[12px] text-[13px] font-semibold bg-[var(--system-red)] text-[var(--label-on-accent)] active:scale-[0.98]"
              >
                + Расход
              </button>
            )}
            {segment === "pending" && (
              <div className="text-center text-[11px] text-[var(--label-tertiary)] py-1.5">
                Оплата отмечается в записи — нажмите на запись выше
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentButton({
  label,
  sum,
  tone,
  active,
  onClick,
}: {
  label: string;
  sum: number;
  tone: "income" | "expense" | "pending";
  active: boolean;
  onClick: () => void;
}) {
  const activeColor =
    tone === "income"
      ? "text-[var(--system-green)]"
      : tone === "expense"
        ? "text-[var(--system-red)]"
        : "text-[var(--system-orange)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-[9px] py-1.5 transition ${
        active
          ? "bg-[var(--surface-card)] shadow-[var(--shadow-card)]"
          : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <span
        className={`block text-[10px] font-semibold ${
          active ? activeColor : "text-[var(--label-secondary)]"
        }`}
      >
        {label}
      </span>
      <span
        className={`block text-[13px] font-bold tabular-nums leading-tight ${
          active ? activeColor : "text-[var(--label-secondary)]"
        }`}
      >
        {formatEUR(sum)}
      </span>
    </button>
  );
}

function PendingApptCard({
  apt,
  name,
  onOpen,
}: {
  apt: Appointment;
  name: string;
  onOpen?: (apt: Appointment) => void;
}) {
  const debt = getDebtAmount(apt);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(apt)}
      disabled={!onOpen}
      className="w-full text-left rounded-[10px] bg-[rgba(255,149,0,0.10)] px-2.5 py-2 active:scale-[0.99] disabled:active:scale-100"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[12px] text-[var(--label)] truncate flex-1">{name}</span>
        <span className="text-[11px] text-[var(--label-tertiary)] tabular-nums flex-shrink-0">
          {apt.time_start}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {onOpen ? (
          <span className="text-[10px] font-semibold text-[var(--system-orange)] border border-[var(--system-orange)] rounded-full px-2 py-[1px]">
            Отметить оплату
          </span>
        ) : (
          <span className="text-[11px] text-[var(--label-tertiary)]">не оплачено</span>
        )}
        <span className="text-[13px] font-semibold tabular-nums text-[var(--system-orange)]">
          ~{formatEUR(debt)}
        </span>
      </div>
    </button>
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
    <div className="rounded-[10px] bg-[rgba(52,199,89,0.08)] px-2.5 py-2">
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
  const tintBg = isIncome ? "bg-[rgba(52,199,89,0.08)]" : "bg-[rgba(255,59,48,0.08)]";
  return (
    <div className={`rounded-[10px] ${tintBg} px-2.5 py-2 relative`}>
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
      {extra.receipt_url && <ReceiptPreview path={extra.receipt_url} />}
    </div>
  );
}

function EmptyHint({ text = "Пусто" }: { text?: string }) {
  return (
    <div className="px-2 py-3 text-[11px] text-[var(--label-tertiary)] text-center">
      {text}
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
