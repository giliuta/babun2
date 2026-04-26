"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useDayExtras,
  useExpenseCategories,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import { formatEUR, formatEURSigned, formatPercentDelta } from "@babun/shared/common/utils/money";
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
            className="inline-flex items-center gap-1.5 px-2 py-1.5 lg:px-3 text-[13px] font-medium text-[var(--accent)] active:opacity-70 hover:bg-[var(--fill-tertiary)] rounded-lg"
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Категории
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-8 space-y-3 stagger-children">
          <ProfitHero
            profit={profit}
            income={totalIncome}
            expense={totalExpense}
            period={selectedPeriodLabel}
            delta={comparableToPrev ? percentDelta(profit, prevProfit) : null}
            onClick={() => setMode("summary")}
            active={mode === "summary"}
          />

          <div className="grid grid-cols-3 gap-1.5">
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
              label="Долги"
              amount={totalDebt}
              color="amber"
              active={mode === "debts"}
              onClick={() => setMode("debts")}
            />
          </div>

          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--separator)] relative flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPeriodMenu((s) => !s)}
                className="flex items-center gap-1 text-[15px] font-semibold text-[var(--label)] hover:opacity-80"
              >
                {selectedPeriodLabel}
                <ChevronDown size={16} strokeWidth={2} className="text-[var(--label-tertiary)]" />
              </button>
              <button
                type="button"
                onClick={() => setMode("payroll")}
                className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition ${
                  mode === "payroll"
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--fill-secondary)]"
                }`}
              >
                Зарплата {totalPayroll > 0 && `· ${formatEUR(totalPayroll)}`}
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full left-4 mt-1 bg-[var(--surface-card)] rounded-lg shadow-[var(--shadow-sheet)] py-1 z-10 min-w-[200px] border border-[var(--separator)]">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPeriod(p.key);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[15px] hover:bg-[var(--fill-quaternary)] ${
                        period === p.key
                          ? "text-[var(--accent)] font-medium"
                          : "text-[var(--label)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex border-b border-[var(--separator)] overflow-x-auto">
              {teamTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTeam(tab.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    activeTeam === tab.id
                      ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                      : "text-[var(--label-secondary)] hover:text-[var(--label)]"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="px-4 py-2 bg-[var(--surface-grouped)] border-b border-[var(--separator)] flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
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

// Hero profit card — shows the dominant metric (profit) with a big
// 32px tabular number and a coloured pill for delta.  Acts as the
// primary visual hook on the page.
function ProfitHero({
  profit,
  income,
  expense,
  period,
  delta,
  active,
  onClick,
}: {
  profit: number;
  income: number;
  expense: number;
  period: string;
  delta: number | null;
  active: boolean;
  onClick: () => void;
}) {
  const positive = profit >= 0;
  const accentBg = positive
    ? "linear-gradient(135deg, #34C759 0%, #00C7BE 100%)"
    : "linear-gradient(135deg, #FF453A 0%, #FF9500 100%)";

  let deltaEl: React.ReactNode = null;
  if (delta !== null && Number.isFinite(delta)) {
    const sign = delta > 0 ? "+" : "";
    deltaEl = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold bg-white/20 text-white">
        {sign}
        {delta.toFixed(0)}%
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="w-full text-left rounded-2xl overflow-hidden p-4 active:scale-[0.99] transition"
      style={{
        background: accentBg,
        boxShadow: active
          ? "0 8px 24px -8px rgba(52,199,89,0.45), 0 0 0 2px rgba(255,255,255,0.5)"
          : "0 8px 24px -10px rgba(52,199,89,0.35)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-white/85">
            Прибыль · {period}
          </div>
          <div className="mt-1 text-[34px] font-bold tabular-nums text-white leading-none">
            {formatEURSigned(profit)}
          </div>
        </div>
        {deltaEl}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[13px] text-white/90">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Доход <strong className="font-semibold tabular-nums">{formatEUR(income)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          Расход <strong className="font-semibold tabular-nums">{formatEUR(expense)}</strong>
        </span>
      </div>
    </button>
  );
}

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
      ? "text-[var(--system-green)]"
      : color === "rose"
      ? "text-[var(--system-red)]"
      : color === "amber"
      ? "text-[var(--system-orange)]"
      : "text-[var(--accent)]";

  const dotColor =
    color === "emerald"
      ? "bg-[var(--system-green)]"
      : color === "rose"
      ? "bg-[var(--system-red)]"
      : color === "amber"
      ? "bg-[var(--system-orange)]"
      : "bg-[var(--accent)]";

  const body = signed ? formatEURSigned(amount) : formatEUR(amount);

  let deltaEl: React.ReactNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const positive = delta > 0;
    const goodDirection = deltaPositiveGood ? positive : !positive;
    const deltaColor =
      delta === 0
        ? "text-[var(--label-tertiary)]"
        : goodDirection
        ? "text-[var(--system-green)]"
        : "text-[var(--system-red)]";
    deltaEl = (
      <div className={`text-[11px] font-semibold tabular-nums ${deltaColor}`}>
        {formatPercentDelta(delta)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`stat-tile text-left transition active:scale-[0.98] ${
        active ? "ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          {label}
        </div>
      </div>
      <div className={`text-[16px] font-bold tabular-nums mt-1 ${amountColor}`}>{body}</div>
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
      <div className="px-4 py-4 space-y-3 border-b border-[var(--separator)]">
        <Row label="Доход" value={`+${formatEUR(totalIncome)}`} color="emerald" />
        <Row label="Расход" value={`−${formatEUR(totalExpense)}`} color="rose" />
        <div className="h-px bg-[var(--separator)]" />
        <Row
          label="Прибыль"
          value={formatEURSigned(profit)}
          color={profit >= 0 ? "indigo" : "rose"}
          bold
        />
        <Row label="Маржа" value={`${margin}%`} color="gray" />
      </div>

      <div className="px-4 py-3 border-b border-[var(--separator)] bg-[var(--surface-grouped)]">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Счёт записей
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[13px]">
          <div className="text-[var(--label-secondary)]">
            Доходных строк: <span className="font-semibold text-[var(--label)]">{incomeCount}</span>
          </div>
          <div className="text-[var(--label-secondary)]">
            Расходных строк: <span className="font-semibold text-[var(--label)]">{expenseCount}</span>
          </div>
        </div>
      </div>

      {profit < 0 && (
        <div className="px-4 py-3 text-[13px] text-[var(--system-red)] bg-[var(--fill-tertiary)] border-b border-[var(--separator)]">
          За выбранный период расходы превышают доходы.
        </div>
      )}

      {incomeCount === 0 && expenseCount === 0 && (
        <div className="px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
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
    <div className="px-4 py-4 border-t border-[var(--separator)] bg-[var(--surface-card)]">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
        Сверка кассы
      </div>
      <div className="space-y-1.5">
        <KV label="Пришло наличкой" value={`+${formatEUR(cash)}`} tone="emerald" />
        <KV label="Пришло на карту" value={`+${formatEUR(card)}`} tone="sky" />
        <div className="h-px bg-[var(--separator)] my-1" />
        <KV label="Расходы (из нала)" value={`−${formatEUR(expense)}`} tone="rose" />
        <KV label="ЗП бригаде (расчётная)" value={`−${formatEUR(salary)}`} tone="violet" />
        <div className="h-px bg-[var(--separator)] my-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[var(--label)]">В кассе должно быть</span>
          <span
            className={`text-[17px] font-bold tabular-nums ${
              shouldBe >= 0 ? "text-[var(--system-green)]" : "text-[var(--system-red)]"
            }`}
          >
            {formatEURSigned(shouldBe)}
          </span>
        </div>
      </div>
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
      ? "text-[var(--system-green)]"
      : tone === "sky"
      ? "text-[var(--system-blue)]"
      : tone === "rose"
      ? "text-[var(--system-red)]"
      : "text-[var(--accent)]";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[var(--label-secondary)]">{label}</span>
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
      ? "text-[var(--system-green)]"
      : color === "rose"
      ? "text-[var(--system-red)]"
      : color === "indigo"
      ? "text-[var(--accent)]"
      : "text-[var(--label-secondary)]";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-[var(--label-secondary)]">{label}</span>
      <span
        className={`tabular-nums ${colorClass} ${bold ? "text-[16px] font-bold" : "text-[14px] font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}
