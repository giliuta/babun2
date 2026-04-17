"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useDayExtras,
  useExpenseCategories,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import { formatEUR, formatEURSigned, formatPercentDelta } from "@/lib/money";
import {
  useFinanceData,
  PERIODS,
  percentDelta,
  type PeriodKey,
} from "@/hooks/useFinanceData";
import {
  IncomeTab,
  ExpenseGroups,
  DebtsTab,
  PayrollTab,
  ExpenseCategoriesSheet,
} from "./FinanceTabs";

type Mode = "income" | "expenses" | "summary" | "debts" | "payroll";

const MODE_LABELS: Record<Mode, string> = {
  income: "Доходы",
  expenses: "Расходы",
  summary: "Итого",
  debts: "Долги клиентов",
  payroll: "Зарплата бригад",
};

export default function FinancesPage() {
  const router = useRouter();
  const { appointments } = useAppointments();
  const { getExtrasFor } = useDayExtras();
  const { categories, setCategories } = useExpenseCategories();
  const { services } = useServices();
  const { teams } = useTeams();
  const { clients } = useClients();

  const [mode, setMode] = useState<Mode>("summary");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [showCategories, setShowCategories] = useState(false);

  const {
    teamTabs,
    teamById,
    clientsById,
    filteredIncome,
    filteredExpenses,
    totalIncome,
    totalExpense,
    profit,
    prevIncome,
    prevExpense,
    prevProfit,
    cashbox,
    debtsByClient,
    totalDebt,
    payroll,
    totalPayroll,
    servicesBreakdown,
    expensesGrouped,
    comparableToPrev,
    selectedPeriodLabel,
  } = useFinanceData({
    appointments,
    teams,
    services,
    clients,
    getExtrasFor,
    categories,
    period,
    activeTeam,
  });

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
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-8 space-y-3 stagger-children">
          <div className="grid grid-cols-4 gap-1.5">
            <SummaryCard
              label="Доход"
              amount={totalIncome}
              color="emerald"
              active={mode === "income"}
              onClick={() => setMode("income")}
              delta={comparableToPrev ? percentDelta(totalIncome, prevIncome) : null}
              deltaPositiveGood
            />
            <SummaryCard
              label="Расход"
              amount={totalExpense}
              color="rose"
              active={mode === "expenses"}
              onClick={() => setMode("expenses")}
              delta={comparableToPrev ? percentDelta(totalExpense, prevExpense) : null}
            />
            <SummaryCard
              label="Прибыль"
              amount={profit}
              signed
              color={profit >= 0 ? "indigo" : "rose"}
              active={mode === "summary"}
              onClick={() => setMode("summary")}
              delta={comparableToPrev ? percentDelta(profit, prevProfit) : null}
              deltaPositiveGood
            />
            <SummaryCard
              label="Долги"
              amount={totalDebt}
              color="amber"
              active={mode === "debts"}
              onClick={() => setMode("debts")}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 relative flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPeriodMenu((s) => !s)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-900 hover:opacity-80"
              >
                {selectedPeriodLabel}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setMode("payroll")}
                className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition ${
                  mode === "payroll"
                    ? "bg-violet-600 text-white"
                    : "bg-violet-50 text-violet-700 active:bg-violet-100"
                }`}
              >
                Зарплата {totalPayroll > 0 && `· ${formatEUR(totalPayroll)}`}
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full left-4 mt-1 bg-white rounded-lg shadow-lg py-1 z-10 min-w-[200px] border border-gray-200">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPeriod(p.key);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        period === p.key ? "text-indigo-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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

            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {MODE_LABELS[mode]}
              </div>
            </div>

            {mode === "income" && (
              <IncomeTab
                entries={filteredIncome}
                total={totalIncome}
                teamById={teamById}
                services={servicesBreakdown}
              />
            )}

            {mode === "expenses" && (
              <ExpenseGroups
                groups={expensesGrouped}
                categories={categories}
                total={totalExpense}
                teamById={teamById}
              />
            )}

            {mode === "summary" && (
              <>
                <CombinedSummary
                  incomeCount={filteredIncome.length}
                  expenseCount={filteredExpenses.length}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                />
                <CashboxBlock
                  cash={cashbox.cash}
                  card={cashbox.card}
                  expense={cashbox.expense}
                  salary={cashbox.salary}
                  shouldBe={cashbox.shouldBe}
                />
              </>
            )}

            {mode === "debts" && (
              <DebtsTab
                groups={debtsByClient}
                total={totalDebt}
                onOpenClient={(clientId) => {
                  if (!clientId) return;
                  router.push(`/dashboard/clients?id=${clientId}`);
                }}
                clientsById={clientsById}
              />
            )}

            {mode === "payroll" && (
              <PayrollTab entries={payroll} total={totalPayroll} />
            )}
          </div>
        </div>
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

// ─── Local sub-components (UI only, no data logic) ─────────────────────────

function SummaryCard({
  label,
  amount,
  color,
  active,
  onClick,
  delta,
  signed,
  deltaPositiveGood,
}: {
  label: string;
  amount: number;
  color: "emerald" | "rose" | "indigo" | "amber";
  active: boolean;
  onClick: () => void;
  delta?: number | null;
  signed?: boolean;
  deltaPositiveGood?: boolean;
}) {
  const amountColor =
    color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
      ? "text-rose-600"
      : color === "amber"
      ? "text-amber-600"
      : "text-indigo-600";

  const body = signed ? formatEURSigned(amount) : formatEUR(amount);

  let deltaEl: React.ReactNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const positive = delta > 0;
    const goodDirection = deltaPositiveGood ? positive : !positive;
    const deltaColor =
      delta === 0 ? "text-gray-400" : goodDirection ? "text-emerald-600" : "text-rose-500";
    deltaEl = (
      <div className={`text-[10px] font-semibold tabular-nums ${deltaColor}`}>
        {formatPercentDelta(delta)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-2 py-2 text-left transition active:scale-[0.98] ${
        active ? "bg-white border-indigo-500 ring-1 ring-indigo-500" : "bg-white border-gray-200"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`text-[13px] font-bold tabular-nums mt-0.5 ${amountColor}`}>{body}</div>
      {deltaEl}
    </button>
  );
}

function CombinedSummary({
  incomeCount,
  expenseCount,
  totalIncome,
  totalExpense,
}: {
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
}) {
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0;

  return (
    <div>
      <div className="px-4 py-4 space-y-3 border-b border-gray-200">
        <Row label="Доход" value={`+${formatEUR(totalIncome)}`} color="emerald" />
        <Row label="Расход" value={`−${formatEUR(totalExpense)}`} color="rose" />
        <div className="h-px bg-gray-200" />
        <Row
          label="Прибыль"
          value={formatEURSigned(profit)}
          color={profit >= 0 ? "indigo" : "rose"}
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
            Доходных строк: <span className="font-semibold">{incomeCount}</span>
          </div>
          <div className="text-gray-700">
            Расходных строк: <span className="font-semibold">{expenseCount}</span>
          </div>
        </div>
      </div>

      {profit < 0 && (
        <div className="px-4 py-3 text-[12px] text-rose-600 bg-rose-50 border-b border-rose-100">
          ⚠ За выбранный период расходы превышают доходы.
        </div>
      )}

      {incomeCount === 0 && expenseCount === 0 && (
        <div className="px-4 py-6 text-center text-[12px] text-gray-400">
          Нет данных за выбранный период.
        </div>
      )}
    </div>
  );
}

function CashboxBlock({
  cash,
  card,
  expense,
  salary,
  shouldBe,
}: {
  cash: number;
  card: number;
  expense: number;
  salary: number;
  shouldBe: number;
}) {
  return (
    <div className="px-4 py-4 border-t border-gray-200 bg-white">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
        Сверка кассы
      </div>
      <div className="space-y-1.5">
        <KV label="Пришло наличкой" value={`+${formatEUR(cash)}`} tone="emerald" />
        <KV label="Пришло на карту" value={`+${formatEUR(card)}`} tone="sky" />
        <div className="h-px bg-gray-100 my-1" />
        <KV label="Расходы (из нала)" value={`−${formatEUR(expense)}`} tone="rose" />
        <KV label="ЗП бригаде (расчётная)" value={`−${formatEUR(salary)}`} tone="violet" />
        <div className="h-px bg-gray-200 my-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-900">В кассе должно быть</span>
          <span
            className={`text-[17px] font-bold tabular-nums ${
              shouldBe >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatEURSigned(shouldBe)}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Реальная сверка с вводом фактической суммы — в следующем обновлении.
      </p>
    </div>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "rose" | "violet";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "sky"
      ? "text-sky-600"
      : tone === "rose"
      ? "text-rose-600"
      : "text-violet-600";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span className={`text-[14px] font-semibold tabular-nums ${color}`}>{value}</span>
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
  color: "emerald" | "rose" | "indigo" | "gray";
  bold?: boolean;
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
      ? "text-rose-600"
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
