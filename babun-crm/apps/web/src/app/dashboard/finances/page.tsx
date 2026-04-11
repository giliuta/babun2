"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { MOCK_INCOME, MOCK_EXPENSES } from "@/lib/mock-data";
import { useExpenseCategories, useTeams } from "@/app/dashboard/layout";
import {
  createBlankExpenseCategory,
  type ExpenseCategory,
} from "@/lib/expense-categories";

// Unified Finance page — replaces separate /income and /expenses routes.
// Top-level tab switches between income, expenses, and a combined P&L view.

type Mode = "income" | "expenses" | "summary";

const PERIODS = [
  "За последние 7 дней",
  "За последние 30 дней",
  "За текущий месяц",
  "За все время",
] as const;

const MODE_LABELS: Record<Mode, string> = {
  income: "Доходы",
  expenses: "Расходы",
  summary: "Итого",
};

export default function FinancesPage() {
  const { categories, setCategories } = useExpenseCategories();
  const { teams } = useTeams();
  const [mode, setMode] = useState<Mode>("summary");
  const [period, setPeriod] = useState<string>(PERIODS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [showCategories, setShowCategories] = useState(false);

  const teamTabs = useMemo(
    () => [
      { id: "all", name: "Все" },
      ...teams.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    ],
    [teams]
  );

  const filteredIncome = useMemo(() => {
    if (activeTeam === "all") return MOCK_INCOME;
    const name = teamTabs.find((t) => t.id === activeTeam)?.name ?? "";
    return MOCK_INCOME.filter((e) => e.team === name);
  }, [activeTeam, teamTabs]);

  const filteredExpenses = useMemo(() => {
    if (activeTeam === "all") return MOCK_EXPENSES;
    const name = teamTabs.find((t) => t.id === activeTeam)?.name ?? "";
    return MOCK_EXPENSES.filter((e) => e.team === name);
  }, [activeTeam, teamTabs]);

  const totalIncome = filteredIncome.reduce((s, e) => s + e.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalIncome - totalExpense;

  const expensesGrouped = useMemo(() => {
    const groups = new Map<string, typeof MOCK_EXPENSES>();
    for (const e of filteredExpenses) {
      if (!groups.has(e.category)) groups.set(e.category, []);
      groups.get(e.category)!.push(e);
    }
    return Array.from(groups.entries());
  }, [filteredExpenses]);

  return (
    <>
      <PageHeader
        title="Финансы"
        rightContent={
          <button
            type="button"
            onClick={() => setShowCategories(true)}
            className="px-2 py-1.5 lg:px-3 text-xs lg:text-sm font-medium text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 rounded-lg"
          >
            ⚙ Категории
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-3">
          {/* Summary cards — always visible above the list */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Доход"
              value={`+${totalIncome}€`}
              color="emerald"
              active={mode === "income"}
              onClick={() => setMode("income")}
            />
            <SummaryCard
              label="Расход"
              value={`−${totalExpense}€`}
              color="red"
              active={mode === "expenses"}
              onClick={() => setMode("expenses")}
            />
            <SummaryCard
              label="Прибыль"
              value={`${profit >= 0 ? "+" : ""}${profit}€`}
              color={profit >= 0 ? "indigo" : "red"}
              active={mode === "summary"}
              onClick={() => setMode("summary")}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Period selector */}
            <div className="px-4 py-3 border-b border-gray-200 relative">
              <button
                type="button"
                onClick={() => setShowPeriodMenu((s) => !s)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-900 hover:opacity-80"
              >
                {period}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full left-4 mt-1 bg-white rounded-lg shadow-lg py-1 z-10 min-w-[200px] border border-gray-200">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPeriod(p);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        period === p ? "text-indigo-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {teamTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTeam(tab.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTeam === tab.id
                      ? "text-indigo-600 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Mode tab indicator */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {MODE_LABELS[mode]}
              </div>
              {mode === "summary" && (
                <div className="text-[11px] text-gray-500">
                  Доход − расход
                </div>
              )}
            </div>

            {/* Content */}
            {mode === "income" && (
              <IncomeList entries={filteredIncome} total={totalIncome} />
            )}

            {mode === "expenses" && (
              <ExpenseGroups
                groups={expensesGrouped}
                categories={categories}
                total={totalExpense}
              />
            )}

            {mode === "summary" && (
              <CombinedSummary
                income={filteredIncome}
                expenses={filteredExpenses}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
              />
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          type="button"
          aria-label={mode === "expenses" ? "Добавить расход" : "Добавить доход"}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-indigo-700"
        >
          +
        </button>
      </div>

      {showCategories && (
        <ExpenseCategoriesSheet
          categories={categories}
          onClose={() => setShowCategories(false)}
          onSave={(next) => {
            setCategories(next);
            setShowCategories(false);
          }}
        />
      )}
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  color: "emerald" | "red" | "indigo";
  active: boolean;
  onClick: () => void;
}

function SummaryCard({ label, value, color, active, onClick }: SummaryCardProps) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
        ? "text-red-600"
        : "text-indigo-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition active:scale-[0.98] ${
        active
          ? "bg-white border-indigo-500 ring-1 ring-indigo-500"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`text-[15px] font-bold tabular-nums mt-1 ${colorClass}`}>
        {value}
      </div>
    </button>
  );
}

function IncomeList({
  entries,
  total,
}: {
  entries: typeof MOCK_INCOME;
  total: number;
}) {
  return (
    <>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {entry.description}
            </div>
            <div className="text-xs text-gray-500">
              {entry.date} • {entry.team}
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-600">
            +{entry.amount} €
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="text-center text-gray-400 py-10 text-sm">Нет записей</div>
      )}
      <TotalRow label="Итого доход" value={total} color="emerald" />
    </>
  );
}

function ExpenseGroups({
  groups,
  categories,
  total,
}: {
  groups: [string, typeof MOCK_EXPENSES][];
  categories: ExpenseCategory[];
  total: number;
}) {
  return (
    <>
      {groups.map(([catName, entries]) => {
        const cat = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase()
        );
        const catTotal = entries.reduce((s, e) => s + e.amount, 0);
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
              <span className="text-sm font-bold text-red-600">−{catTotal}€</span>
            </div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {entry.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.date} • {entry.team}
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-600">
                  −{entry.amount} €
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className="text-center text-gray-400 py-10 text-sm">Нет записей</div>
      )}
      <TotalRow label="Итого расход" value={-total} color="red" />
    </>
  );
}

function CombinedSummary({
  income,
  expenses,
  totalIncome,
  totalExpense,
}: {
  income: typeof MOCK_INCOME;
  expenses: typeof MOCK_EXPENSES;
  totalIncome: number;
  totalExpense: number;
}) {
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0;

  return (
    <div>
      <div className="px-4 py-4 space-y-3 border-b border-gray-200">
        <Row label="Доход" value={`+${totalIncome}€`} color="emerald" />
        <Row label="Расход" value={`−${totalExpense}€`} color="red" />
        <div className="h-px bg-gray-200" />
        <Row
          label="Прибыль"
          value={`${profit >= 0 ? "+" : ""}${profit}€`}
          color={profit >= 0 ? "indigo" : "red"}
          bold
        />
        <Row label="Маржа" value={`${margin}%`} color="gray" />
      </div>

      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Счёт записей
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
          <div className="text-gray-700">
            Доходных: <span className="font-semibold">{income.length}</span>
          </div>
          <div className="text-gray-700">
            Расходных: <span className="font-semibold">{expenses.length}</span>
          </div>
        </div>
      </div>

      {profit < 0 && (
        <div className="px-4 py-3 text-[12px] text-red-600 bg-red-50 border-b border-red-100">
          ⚠ За выбранный период расходы превышают доходы.
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "indigo" | "gray";
  bold?: boolean;
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
        ? "text-red-600"
        : color === "indigo"
          ? "text-indigo-600"
          : "text-gray-600";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span
        className={`tabular-nums ${colorClass} ${bold ? "text-[16px] font-bold" : "text-[14px] font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "red";
}) {
  const colorClass = color === "emerald" ? "text-emerald-600" : "text-red-600";
  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}:</span>
        <span className={`text-base font-bold tabular-nums ${colorClass}`}>
          {value >= 0 ? "+" : ""}
          {value} €
        </span>
      </div>
    </div>
  );
}

// ─── Categories management sheet (unchanged from old expenses page) ────

function ExpenseCategoriesSheet({
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
  const remove = (id: string) =>
    setDraft((prev) => prev.filter((c) => c.id !== id));
  const add = () => setDraft((prev) => [...prev, createBlankExpenseCategory()]);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Категории расходов
          </h2>
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
            <div
              key={c.id}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
            >
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
                className="w-8 h-8 text-red-500 hover:bg-red-50 rounded"
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
