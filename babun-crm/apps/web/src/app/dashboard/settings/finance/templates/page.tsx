"use client";

// Templates CRUD for the «Операция» quick-entry chip-row. Each template
// is a pre-filled shortcut (Аренда €1500, ЗП Юре €800, Чаевые €20). The
// chip-row in OperationSheet reads from this list.

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useTenantId,
  useTeams,
} from "@/components/layout/DashboardClientLayout";
import { useAccounts, useFinanceTemplates, useFinanceCategories } from "@/lib/finance/hooks";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTemplate } from "@babun/shared/local/finance/template";
import type { TemplateDraft } from "@babun/shared/db/repositories/finance-templates";
import type { PaymentMethod } from "@babun/shared/local/finance/transaction";
import DialogModal from "@/components/appointment/DialogModal";

const METHOD_LABELS: Array<{ key: PaymentMethod; label: string; emoji: string }> = [
  { key: "cash", label: "Наличные", emoji: "💵" },
  { key: "card", label: "Карта", emoji: "💳" },
  { key: "transfer", label: "Перевод", emoji: "🏦" },
  { key: "other", label: "Иное", emoji: "📦" },
];

export default function FinanceTemplatesPage() {
  const tenantId = useTenantId();
  const { teams } = useTeams();
  const { accounts } = useAccounts(tenantId);
  const { categories } = useFinanceCategories(tenantId);
  const { templates, add, update, remove } = useFinanceTemplates(tenantId);

  const [editing, setEditing] = useState<FinanceTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Шаблоны операций" backHref="/dashboard/settings/finance" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-3">
          <div className="text-[12px] text-[var(--label-secondary)] leading-snug">
            Шаблоны показываются как чипсы сверху формы «+ Доход / + Расход».
            Тап по чипсу — поля формы заполняются автоматически.
          </div>

          {templates.length > 0 ? (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
              {templates.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditing(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--fill-quaternary)] transition-colors ${
                    idx > 0 ? "border-t border-[var(--separator)]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--label)] truncate">{t.name}</div>
                    <div className="text-[12px] text-[var(--label-tertiary)] truncate">
                      {t.kind === "income" ? "Доход" : "Расход"}
                      {t.payment_method && ` · ${methodLabel(t.payment_method)}`}
                      {t.brigade_id && ` · ${teams.find((tt) => tt.id === t.brigade_id)?.name ?? t.brigade_id}`}
                    </div>
                  </div>
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${
                      t.kind === "income"
                        ? "text-[var(--system-green)]"
                        : "text-[var(--system-red)]"
                    }`}
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {formatEUR(t.amount)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--surface-card)] rounded-2xl px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
              Шаблонов пока нет
            </div>
          )}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full h-11 rounded-[var(--radius-pill)] text-[13px] font-semibold border border-dashed border-[var(--accent)]/40 text-[var(--accent)] active:scale-[0.98]"
          >
            + Новый шаблон
          </button>
        </div>
      </div>

      {creating && (
        <TemplateEditor
          open
          onClose={() => setCreating(false)}
          initial={null}
          teams={teams}
          accounts={accounts}
          categories={categories}
          onSave={async (draft) => {
            await add(draft);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <TemplateEditor
          open
          onClose={() => setEditing(null)}
          initial={editing}
          teams={teams}
          accounts={accounts}
          categories={categories}
          onSave={async (draft) => {
            await update(editing.id, draft);
            setEditing(null);
          }}
          onDelete={async () => {
            await remove(editing.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function methodLabel(m: string): string {
  return METHOD_LABELS.find((x) => x.key === m)?.label ?? m;
}

interface TemplateEditorProps {
  open: boolean;
  onClose: () => void;
  initial: FinanceTemplate | null;
  teams: ReturnType<typeof useTeams>["teams"];
  accounts: ReturnType<typeof useAccounts>["accounts"];
  categories: ReturnType<typeof useFinanceCategories>["categories"];
  onSave: (draft: TemplateDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function TemplateEditor({
  open,
  onClose,
  initial,
  teams,
  accounts,
  categories,
  onSave,
  onDelete,
}: TemplateEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"income" | "expense">(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [method, setMethod] = useState<PaymentMethod>(
    (initial?.payment_method ?? "cash") as PaymentMethod,
  );
  const [brigadeId, setBrigadeId] = useState(initial?.brigade_id ?? "");
  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const numericAmount = parseFloat(amount.replace(",", ".")) || 0;
  const canSave = name.trim().length > 0 && numericAmount > 0;

  const visibleCategories = categories.filter((c) => c.type === kind);
  const visibleAccounts = brigadeId
    ? accounts.filter((a) => a.brigade_id === brigadeId)
    : accounts;

  const handleSave = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        kind,
        amount: numericAmount,
        payment_method: method,
        brigade_id: brigadeId || null,
        account_id: accountId || null,
        category_id: categoryId || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={initial ? "Изменить шаблон" : "Новый шаблон"}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className={`h-12 px-4 rounded-[var(--radius-pill)] text-[13px] font-semibold disabled:opacity-50 transition-colors ${
                confirmDel
                  ? "bg-[var(--system-red)] text-[var(--label-on-accent)]"
                  : "text-[var(--system-red)] border border-[var(--system-red)]/40"
              }`}
            >
              {confirmDel ? "Точно?" : "Удалить"}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || busy}
            className="flex-1 h-12 rounded-[var(--radius-pill)] text-[14px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] disabled:opacity-50"
          >
            {busy ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      }
    >
      <div className="px-3 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <KindBtn label="Доход" active={kind === "income"} tone="income" onClick={() => setKind("income")} />
          <KindBtn label="Расход" active={kind === "expense"} tone="expense" onClick={() => setKind("expense")} />
        </div>

        <Field label="Название" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Аренда, ЗП Юре, Чаевые"
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 ml-1 h-11 bg-transparent text-[15px] focus:outline-none tabular-nums"
            />
          </div>
        </Field>

        <Field label="Бригада">
          <select
            value={brigadeId}
            onChange={(e) => setBrigadeId(e.target.value)}
            className={inputCls}
          >
            <option value="">— не указана —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Счёт">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputCls}
          >
            <option value="">— не указан —</option>
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon ?? "💵"} {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Категория">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputCls}
          >
            <option value="">— не указана —</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ?? "•"} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Способ оплаты">
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
            {METHOD_LABELS.map((m) => {
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
      </div>
    </DialogModal>
  );
}

function KindBtn({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "income" | "expense";
  onClick: () => void;
}) {
  const activeCls =
    tone === "income"
      ? "bg-[rgba(52,199,89,0.16)] text-[var(--system-green)] border-[rgba(52,199,89,0.4)]"
      : "bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] border-[rgba(255,59,48,0.3)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-[12px] text-[14px] font-semibold border transition active:scale-[0.98] ${
        active ? activeCls : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] border-transparent"
      }`}
    >
      {label}
    </button>
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
