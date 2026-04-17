"use client";

import { useState } from "react";
import { formatDateLongRu } from "@/lib/date-utils";
import { formatEUR, formatEURSigned } from "@/lib/money";
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
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет доходных записей
      </div>
    );
  }
  return (
    <>
      {services.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-emerald-50/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      <span className="text-[13px] text-gray-900 truncate">{s.name}</span>
                      <span className="text-[12px] font-semibold text-emerald-700 tabular-nums">
                        {formatEUR(s.revenue)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 tabular-nums">
                      {s.count} зак. · ср. {formatEUR(avg)} · {Math.round(pct)}%
                    </div>
                    <div className="h-1 bg-emerald-100 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">{entry.description}</div>
            <div className="text-xs text-gray-500 truncate">
              {formatDateLongRu(entry.dateKey)}
              {entry.teamId && teamById.get(entry.teamId) ? ` • ${teamById.get(entry.teamId)}` : ""}
              {entry.sourceType === "extra" ? " • вручную" : ""}
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-600 tabular-nums">
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
      <div className="text-center text-gray-400 py-10 text-sm">
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
              className="px-4 py-2 bg-gray-50 border-y border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: cat ? `${cat.color}12` : undefined }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.icon ?? "📋"}</span>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {catName}
                </span>
              </div>
              <span className="text-sm font-bold text-rose-600 tabular-nums">
                −{formatEUR(catTotal)}
              </span>
            </div>
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{entry.description}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {formatDateLongRu(entry.dateKey)}
                    {entry.teamId && teamById.get(entry.teamId) ? ` • ${teamById.get(entry.teamId)}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold text-rose-600 tabular-nums">
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
      <div className="text-center text-gray-400 py-10 text-sm">
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
          <div key={g.clientId ?? g.name} className="border-b border-gray-100">
            <button
              type="button"
              onClick={() => onOpenClient(g.clientId)}
              className="w-full px-4 py-3 flex items-center gap-3 active:bg-gray-50 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900 truncate">{g.name}</div>
                <div className="text-[11px] text-gray-500">
                  {g.items.length} зак. · последний {formatDateLongRu(g.items[0].dateKey)}
                </div>
              </div>
              <div className="text-[15px] font-bold text-rose-600 tabular-nums shrink-0">
                −{formatEUR(g.total)}
              </div>
            </button>
            {phoneDigits && (
              <div className="px-4 pb-3 flex gap-2">
                <a
                  href={`tel:${phoneDigits}`}
                  className="flex-1 h-9 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-emerald-100"
                >
                  Позвонить
                </a>
                <a
                  href={`sms:${phoneDigits}?body=${encodeURIComponent(`Здравствуйте! Напоминаем про оплату €${g.total}. AirFix.`)}`}
                  className="flex-1 h-9 rounded-lg bg-sky-50 text-sky-700 text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-sky-100"
                >
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
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет активных бригад.
      </div>
    );
  }
  return (
    <>
      <div className="px-4 py-2 bg-violet-50/40 border-b border-gray-100 text-[11px] text-gray-600">
        Зарплата = (доход − расход бригады) × процент выплаты. Настраивается в профиле бригады.
      </div>
      {entries.map((p) => (
        <div key={p.team.id} className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.team.color }} />
            <div className="flex-1 text-[14px] font-semibold text-gray-900">{p.team.name}</div>
            <div className="text-[11px] text-gray-500">
              {p.percentage}% × {formatEUR(p.net)}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
            <Kv label="Доход" value={`+${formatEUR(p.income)}`} color="emerald" />
            <Kv label="Расход" value={`−${formatEUR(p.expense)}`} color="rose" />
            <Kv label="Чистый" value={formatEURSigned(p.net)} color="indigo" />
          </div>
          <div className="mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[12px] text-gray-600">К выплате</span>
            <span className="text-[16px] font-bold text-violet-700 tabular-nums">
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
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Категории расходов</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {draft.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <input
                type="text"
                value={c.icon}
                onChange={(e) => update(c.id, { icon: e.target.value.slice(0, 2) })}
                className="w-10 text-center text-xl bg-white border border-gray-300 rounded"
                placeholder="📋"
              />
              <input
                type="color"
                value={c.color}
                onChange={(e) => update(c.id, { color: e.target.value })}
                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                placeholder="Название"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
              />
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="w-8 h-8 text-rose-500 hover:bg-rose-50 rounded"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full py-2 text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            + Новая категория
          </button>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600"
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
    color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : "text-indigo-600";
  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}:</span>
        <span className={`text-base font-bold tabular-nums ${colorClass}`}>
          {formatEURSigned(value)}
        </span>
      </div>
    </div>
  );
}

function Kv({ label, value, color }: { label: string; value: string; color: "emerald" | "rose" | "indigo" }) {
  const cc =
    color === "emerald" ? "text-emerald-700" : color === "rose" ? "text-rose-700" : "text-indigo-700";
  return (
    <div className="bg-gray-50 rounded-md px-2 py-1">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[12px] font-semibold tabular-nums ${cc}`}>{value}</div>
    </div>
  );
}
