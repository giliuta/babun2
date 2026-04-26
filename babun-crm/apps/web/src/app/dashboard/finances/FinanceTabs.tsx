"use client";

import { useState } from "react";
import { Phone, MessageSquare, Plus, X, Tag } from "lucide-react";
import { formatDateLongRu } from "@babun/shared/common/utils/date-utils";
import { formatEUR, formatEURSigned } from "@babun/shared/common/utils/money";
import {
  createBlankExpenseCategory,
  type ExpenseCategory,
} from "@/lib/expense-categories";
import type { Client } from "@/lib/clients";
import type { Team } from "@/lib/masters";
import { sum, type IncomeLine, type ExpenseLine, type DebtLine } from "@/hooks/useFinanceData";

// ─── Income tab ───────────────────────────────────────────────────────────

export function IncomeTab({
  entries,
  total,
  teamById,
  services,
}: {
  entries: IncomeLine[];
  total: number;
  teamById: Map<string, string>;
  services: { name: string; count: number; revenue: number }[];
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-[var(--label-tertiary)] py-10 text-[13px]">
        Нет доходных записей
      </div>
    );
  }
  return (
    <>
      {services.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--separator)] bg-[var(--fill-tertiary)]">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
            По типам услуг
          </div>
          <div className="space-y-1">
            {services.slice(0, 6).map((s) => {
              const avg = s.count > 0 ? Math.round(s.revenue / s.count) : 0;
              const pct = total > 0 ? (s.revenue / total) * 100 : 0;
              return (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-[var(--label)] truncate">{s.name}</span>
                      <span className="text-[12px] font-semibold text-[var(--system-green)] tabular-nums">
                        {formatEUR(s.revenue)}
                      </span>
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                      {s.count} зак. · ср. {formatEUR(avg)} · {Math.round(pct)}%
                    </div>
                    <div className="h-1 bg-[var(--fill-tertiary)] rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-[var(--system-green)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className="px-4 py-3 border-b border-[var(--separator)] flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-[var(--label)] truncate">{entry.description}</div>
            <div className="text-[13px] text-[var(--label-secondary)] truncate">
              {formatDateLongRu(entry.dateKey)}
              {entry.teamId && teamById.get(entry.teamId) ? ` • ${teamById.get(entry.teamId)}` : ""}
              {entry.sourceType === "extra" ? " • вручную" : ""}
            </div>
          </div>
          <div className="text-[15px] font-semibold text-[var(--system-green)] tabular-nums">
            +{formatEUR(entry.amount)}
          </div>
        </div>
      ))}
      <TotalRow label="Итого доход" value={total} color="emerald" />
    </>
  );
}

// ─── Expense groups tab ───────────────────────────────────────────────────

export function ExpenseGroups({
  groups,
  categories,
  total,
  teamById,
}: {
  groups: [string, ExpenseLine[]][];
  categories: ExpenseCategory[];
  total: number;
  teamById: Map<string, string>;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center text-[var(--label-tertiary)] py-10 text-[13px]">
        Нет расходных записей
      </div>
    );
  }
  return (
    <>
      {groups.map(([catName, entries]) => {
        const cat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        const catTotal = sum(entries);
        return (
          <div key={catName}>
            <div
              className="px-4 py-2 bg-[var(--surface-grouped)] border-y border-[var(--separator)] flex items-center justify-between"
              style={{ backgroundColor: cat ? `${cat.color}12` : undefined }}
            >
              <div className="flex items-center gap-2">
                {cat?.icon ? (
                  <span className="text-lg">{cat.icon}</span>
                ) : (
                  <Tag size={16} strokeWidth={2} className="text-[var(--label-secondary)]" />
                )}
                <span className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                  {catName}
                </span>
              </div>
              <span className="text-[15px] font-bold text-[var(--system-red)] tabular-nums">
                −{formatEUR(catTotal)}
              </span>
            </div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 border-b border-[var(--separator)] flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-[var(--label)] truncate">{entry.description}</div>
                  <div className="text-[13px] text-[var(--label-secondary)] truncate">
                    {formatDateLongRu(entry.dateKey)}
                    {entry.teamId && teamById.get(entry.teamId) ? ` • ${teamById.get(entry.teamId)}` : ""}
                  </div>
                </div>
                <div className="text-[15px] font-semibold text-[var(--system-red)] tabular-nums">
                  −{formatEUR(entry.amount)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <TotalRow label="Итого расход" value={-total} color="rose" />
    </>
  );
}

// ─── Debts tab ────────────────────────────────────────────────────────────

export function DebtsTab({
  groups,
  total,
  onOpenClient,
  clientsById,
}: {
  groups: { clientId: string | null; name: string; total: number; items: DebtLine[] }[];
  total: number;
  onOpenClient: (clientId: string | null) => void;
  clientsById: Map<string, Client>;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center text-[var(--label-tertiary)] py-10 text-[13px]">
        Долгов нет — все выплачено.
      </div>
    );
  }
  return (
    <>
      {groups.map((g) => {
        const client = g.clientId ? clientsById.get(g.clientId) : null;
        const phone = client?.phone;
        const phoneDigits = phone?.replace(/\D/g, "") ?? "";
        return (
          <div key={g.clientId ?? g.name} className="border-b border-[var(--separator)]">
            <button
              type="button"
              onClick={() => onOpenClient(g.clientId)}
              className="w-full px-4 py-3 flex items-center gap-3 active:bg-[var(--fill-quaternary)] text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)] truncate">{g.name}</div>
                <div className="text-[13px] text-[var(--label-secondary)]">
                  {g.items.length} зак. · последний {formatDateLongRu(g.items[0].dateKey)}
                </div>
              </div>
              <div className="text-[15px] font-bold text-[var(--system-red)] tabular-nums shrink-0">
                −{formatEUR(g.total)}
              </div>
            </button>
            {phoneDigits && (
              <div className="px-4 pb-3 flex gap-2">
                <a
                  href={`tel:${phoneDigits}`}
                  className="flex-1 h-9 rounded-lg bg-[var(--fill-tertiary)] text-[var(--system-green)] text-[13px] font-semibold flex items-center justify-center gap-1.5 active:bg-[var(--fill-secondary)]"
                >
                  <Phone size={14} strokeWidth={2} />
                  Позвонить
                </a>
                <a
                  href={`sms:${phoneDigits}?body=${encodeURIComponent(`Здравствуйте! Напоминаем про оплату €${g.total}. AirFix.`)}`}
                  className="flex-1 h-9 rounded-lg bg-[var(--fill-tertiary)] text-[var(--system-blue)] text-[13px] font-semibold flex items-center justify-center gap-1.5 active:bg-[var(--fill-secondary)]"
                >
                  <MessageSquare size={14} strokeWidth={2} />
                  SMS напоминание
                </a>
              </div>
            )}
          </div>
        );
      })}
      <TotalRow label="Итого долги" value={-total} color="rose" />
    </>
  );
}

// ─── Payroll tab ──────────────────────────────────────────────────────────

export function PayrollTab({
  entries,
  total,
}: {
  entries: {
    team: Team;
    income: number;
    expense: number;
    net: number;
    percentage: number;
    payable: number;
  }[];
  total: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-[var(--label-tertiary)] py-10 text-[13px]">
        Нет активных бригад.
      </div>
    );
  }
  return (
    <>
      <div className="px-4 py-2 bg-[var(--accent-tint)] border-b border-[var(--separator)] text-[13px] text-[var(--label-secondary)]">
        Зарплата = (доход − расход бригады) × процент выплаты. Настраивается в профиле бригады.
      </div>
      {entries.map((p) => (
        <div key={p.team.id} className="px-4 py-3 border-b border-[var(--separator)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.team.color }} />
            <div className="flex-1 text-[15px] font-semibold text-[var(--label)]">{p.team.name}</div>
            <div className="text-[12px] text-[var(--label-secondary)]">
              {p.percentage}% × {formatEUR(p.net)}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12px]">
            <Kv label="Доход" value={`+${formatEUR(p.income)}`} color="emerald" />
            <Kv label="Расход" value={`−${formatEUR(p.expense)}`} color="rose" />
            <Kv label="Чистый" value={formatEURSigned(p.net)} color="indigo" />
          </div>
          <div className="mt-2 flex items-center justify-between pt-2 border-t border-[var(--separator)]">
            <span className="text-[13px] text-[var(--label-secondary)]">К выплате</span>
            <span className="text-[16px] font-bold text-[var(--accent)] tabular-nums">
              {formatEUR(p.payable)}
            </span>
          </div>
        </div>
      ))}
      <TotalRow label="Всего к выплате" value={total} color="indigo" />
    </>
  );
}

// ─── Expense categories sheet ─────────────────────────────────────────────

export function ExpenseCategoriesSheet({
  categories,
  onClose,
  onSave,
}: {
  categories: ExpenseCategory[];
  onClose: () => void;
  onSave: (next: ExpenseCategory[]) => void;
}) {
  const [draft, setDraft] = useState<ExpenseCategory[]>(categories);

  const update = (id: string, patch: Partial<ExpenseCategory>) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) => setDraft((prev) => prev.filter((c) => c.id !== id));
  const add = () => setDraft((prev) => [...prev, createBlankExpenseCategory()]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2">
      <div className="w-full lg:max-w-lg bg-[var(--surface-card)] rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)]">Категории расходов</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {draft.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 bg-[var(--fill-tertiary)] rounded-lg p-2"
            >
              <input
                type="text"
                value={c.icon}
                onChange={(e) => update(c.id, { icon: e.target.value.slice(0, 2) })}
                className="w-10 text-center text-xl bg-[var(--surface-card)] border border-[var(--separator)] rounded"
                placeholder=""
              />
              <input
                type="color"
                value={c.color}
                onChange={(e) => update(c.id, { color: e.target.value })}
                className="w-10 h-10 border border-[var(--separator)] rounded cursor-pointer"
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                placeholder="Название"
                className="flex-1 px-3 py-2 bg-[var(--surface-card)] border border-[var(--separator)] rounded text-[15px] text-[var(--label)]"
              />
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="w-8 h-8 flex items-center justify-center text-[var(--system-red)] hover:bg-[var(--fill-tertiary)] rounded"
                aria-label="Удалить"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full py-2 text-[13px] font-semibold text-[var(--accent)] border border-dashed border-[var(--accent)] rounded-lg hover:bg-[var(--accent-tint)] inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} strokeWidth={2.5} />
            Новая категория
          </button>
        </div>

        <div className="border-t border-[var(--separator)] px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-[10px] text-[15px] font-medium text-[var(--label)] bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-[10px] text-[15px] font-semibold text-[var(--label-on-accent)] bg-[var(--accent)] active:bg-[var(--accent-pressed)]"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────

function TotalRow({ label, value, color }: { label: string; value: number; color: "emerald" | "rose" | "indigo" }) {
  const colorClass =
    color === "emerald"
      ? "text-[var(--system-green)]"
      : color === "rose"
      ? "text-[var(--system-red)]"
      : "text-[var(--accent)]";
  return (
    <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--surface-grouped)]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[var(--label-secondary)]">{label}:</span>
        <span className={`text-[17px] font-bold tabular-nums ${colorClass}`}>
          {formatEURSigned(value)}
        </span>
      </div>
    </div>
  );
}

function Kv({ label, value, color }: { label: string; value: string; color: "emerald" | "rose" | "indigo" }) {
  const cc =
    color === "emerald"
      ? "text-[var(--system-green)]"
      : color === "rose"
      ? "text-[var(--system-red)]"
      : "text-[var(--accent)]";
  return (
    <div className="bg-[var(--fill-tertiary)] rounded-md px-2 py-1">
      <div className="text-[12px] text-[var(--label-secondary)] uppercase tracking-wider">{label}</div>
      <div className={`text-[12px] font-semibold tabular-nums ${cc}`}>{value}</div>
    </div>
  );
}
