"use client";

// One «Операция» entry (STORY-062 Slice 2): segment Доход/Расход inside a
// single sheet, native amount input.
//  • Доход — pick a calendar appointment (client + service + date выполнения)
//    + service category; links the tx to the appointment (no stacking).
//  • Расход — category + free comment.
// Submits the existing TransactionDraft via the page's insertTransaction.

import { useEffect, useMemo, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account } from "@babun/shared/local/finance/account";
import type { PaymentMethod } from "@babun/shared/local/finance/transaction";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import type { TransactionDraft } from "@babun/shared/db/repositories/finance-transactions";
import type { FinanceTemplate } from "@babun/shared/local/finance/template";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";

interface OperationSheetProps {
  open: boolean;
  onClose: () => void;
  teamId: string | null;
  /** Accounts already scoped to the active team. */
  accounts: Account[];
  categories: FinanceCategory[];
  /** Quick-entry shortcuts curated in Настройки → Финансы → Шаблоны. */
  templates?: FinanceTemplate[];
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  onSubmit: (draft: TransactionDraft) => Promise<void>;
  onAddCategory?: (
    name: string,
    type: "income" | "expense",
  ) => Promise<FinanceCategory>;
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

const RU_MONTHS_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек.",
];
function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`;
}

export default function OperationSheet({
  open,
  onClose,
  teamId,
  accounts,
  categories,
  templates = [],
  appointments,
  clients,
  services,
  onSubmit,
  onAddCategory,
}: OperationSheetProps) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayYmd());
  const [comment, setComment] = useState("");
  const [apptId, setApptId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType("expense");
      setAmount("");
      setAccountId(accounts[0]?.id ?? null);
      setCategoryId(null);
      setMethod("cash");
      setDate(todayYmd());
      setComment("");
      setApptId(null);
      setClientId(null);
      setAddingCat(false);
      setNewCat("");
      setSubmitting(false);
    }
  }, [open, accounts]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const incomeAppts = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== "cancelled" && (!teamId || a.team_id === teamId))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 20),
    [appointments, teamId],
  );

  const serviceName = (a: Appointment): string => {
    const sid = a.service_ids?.[0];
    if (!sid) return "";
    return services.find((s) => s.id === sid)?.name ?? "";
  };
  const clientName = (a: Appointment): string => {
    if (a.client_id) {
      const c = clients.find((x) => x.id === a.client_id);
      if (c?.full_name) return c.full_name;
    }
    return a.comment?.trim() || "Без имени";
  };

  const handlePickAppt = (a: Appointment) => {
    setApptId(a.id);
    setClientId(a.client_id);
    setDate(a.date);
  };

  const switchType = (t: "income" | "expense") => {
    setType(t);
    setCategoryId(null);
    setAddingCat(false);
    setNewCat("");
    if (t === "expense") {
      setApptId(null);
      setClientId(null);
    }
  };

  const applyTemplate = (t: FinanceTemplate) => {
    setType(t.kind);
    setAmount(t.amount ? String(t.amount) : "");
    setCategoryId(t.category_id);
    setAddingCat(false);
    setNewCat("");
    if (t.payment_method) setMethod(t.payment_method);
    // Only adopt the template's account if it exists in the active scope.
    if (t.account_id && accounts.some((a) => a.id === t.account_id)) {
      setAccountId(t.account_id);
    }
    if (t.kind === "expense") {
      setApptId(null);
      setClientId(null);
    }
  };

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);
  const canSave = numericAmount > 0 && !!accountId;

  const handleSave = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    try {
      const draft: TransactionDraft =
        type === "income"
          ? {
              type: "income",
              amount: numericAmount,
              account_id: accountId,
              team_id: teamId,
              category_id: categoryId,
              client_id: clientId,
              appointment_id: apptId,
              payment_method: method,
              occurred_on: date,
            }
          : {
              type: "expense",
              amount: numericAmount,
              account_id: accountId,
              team_id: teamId,
              category_id: categoryId,
              payment_method: method,
              notes: comment.trim() || null,
              occurred_on: date,
            };
      await onSubmit(draft);
      onClose();
    } catch (err) {
      console.error("operation save failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommitCat = async () => {
    const n = newCat.trim();
    if (!n || !onAddCategory) {
      setAddingCat(false);
      return;
    }
    try {
      const cat = await onAddCategory(n, type);
      setCategoryId(cat.id);
    } catch (e) {
      console.error("add category failed", e);
    }
    setAddingCat(false);
    setNewCat("");
  };

  const categoryChips = (
    <ChipRow>
      {visibleCategories.map((c) => (
        <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
          {c.icon ?? "•"} {c.name}
        </Chip>
      ))}
      {onAddCategory &&
        (addingCat ? (
          <>
            <input
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Название"
              autoFocus
              className="flex-shrink-0 w-[124px] h-8 px-3 rounded-full text-[13px] border border-[var(--accent)] bg-[var(--surface-card)] text-[var(--label)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCommitCat}
              aria-label="Добавить категорию"
              className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] inline-flex items-center justify-center"
            >
              ✓
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddingCat(true);
              setNewCat("");
            }}
            aria-label="Новая категория"
            className="flex-shrink-0 h-8 px-3 rounded-full text-[16px] font-semibold bg-[var(--surface-card)] text-[var(--accent)] border border-[var(--separator)]"
          >
            ＋
          </button>
        ))}
    </ChipRow>
  );

  if (!open) return null;
  const tone = type === "income" ? "var(--system-green)" : "var(--system-red)";

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Операция"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || submitting}
          className="w-full h-12 rounded-[var(--radius-pill)] font-semibold text-[15px] text-[var(--label-on-accent)] active:scale-[0.98] transition disabled:opacity-50"
          style={{ backgroundColor: tone }}
        >
          {submitting ? "Сохраняю…" : `Сохранить ${formatEUR(numericAmount || 0)}`}
        </button>
      }
    >
      <div className="px-3 py-3 space-y-3">
        {/* Segment Доход / Расход */}
        <div className="flex bg-[var(--fill-tertiary)] rounded-[10px] p-[3px] gap-[3px]">
          <SegBtn label="Доход" active={type === "income"} color="var(--system-green)" onClick={() => switchType("income")} />
          <SegBtn label="Расход" active={type === "expense"} color="var(--system-red)" onClick={() => switchType("expense")} />
        </div>

        {/* Quick-entry templates — tap fills the form */}
        {templates.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {templates.map((t) => {
              const green = t.kind === "income";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex-shrink-0 h-8 pl-3 pr-2.5 rounded-full text-[13px] font-medium bg-[var(--fill-tertiary)] text-[var(--label)] inline-flex items-center gap-1.5 active:scale-[0.97] transition"
                >
                  <span className="truncate max-w-[120px]">{t.name}</span>
                  <span
                    className="tabular-nums font-semibold"
                    style={{ color: green ? "var(--system-green)" : "var(--system-red)" }}
                  >
                    {green ? "+" : "−"}{formatEUR(t.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Amount — native numeric keyboard */}
        <div className="flex items-center justify-center gap-1 py-1">
          <span className="text-[28px] font-bold" style={{ color: tone }}>€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
            className="w-[160px] bg-transparent text-[34px] font-bold text-center tabular-nums focus:outline-none placeholder:text-[var(--label-tertiary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ color: tone }}
          />
        </div>

        {/* Account */}
        <Field label="Счёт">
          {accounts.length === 0 ? (
            <div className="text-[12px] text-[var(--label-tertiary)]">Нет счетов в команде</div>
          ) : (
            <ChipRow>
              {accounts.map((a) => (
                <Chip key={a.id} active={accountId === a.id} onClick={() => setAccountId(a.id)}>
                  {a.icon ?? "💳"} {a.name}
                </Chip>
              ))}
            </ChipRow>
          )}
        </Field>

        {type === "income" ? (
          <>
            <Field label="За что · запись в календаре">
              <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden border border-[var(--separator)]">
                {incomeAppts.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[12px] text-[var(--label-tertiary)]">
                    Нет записей в календаре
                  </div>
                ) : (
                  incomeAppts.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handlePickAppt(a)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${i > 0 ? "border-t border-[var(--separator)]" : ""} ${apptId === a.id ? "bg-[var(--accent-tint)]" : ""}`}
                    >
                      <span
                        className="w-[18px] h-[18px] rounded-full flex-shrink-0 box-border"
                        style={{ border: apptId === a.id ? "5px solid var(--accent)" : "2px solid var(--label-quaternary)" }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-medium truncate">{clientName(a)}</span>
                        {serviceName(a) && (
                          <span className="block text-[11px] text-[var(--label-tertiary)] truncate">{serviceName(a)}</span>
                        )}
                      </span>
                      <span className="text-[11px] text-[var(--label-tertiary)] flex-shrink-0 whitespace-nowrap">
                        {shortDate(a.date)} {a.time_start}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Field>

            <Field label="Дата выполнения">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Услуга">{categoryChips}</Field>
          </>
        ) : (
          <>
            <Field label="Категория">{categoryChips}</Field>

            <Field label="Комментарий">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: обед бригады"
                className={inputCls}
              />
            </Field>

            <Field label="Дата">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}

        {/* Payment method */}
        <Field label="Способ оплаты">
          <ChipRow>
            {METHODS.map((m) => (
              <Chip key={m.key} active={method === m.key} onClick={() => setMethod(m.key)}>
                {m.emoji} {m.label}
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </div>
    </DialogModal>
  );
}

function SegBtn({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-center text-[14px] font-semibold py-2 rounded-[7px] transition-colors"
      style={
        active
          ? { backgroundColor: "var(--surface-card)", color, boxShadow: "var(--shadow-card)" }
          : { color: "var(--label-secondary)" }
      }
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent"
          : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
      }`}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";
