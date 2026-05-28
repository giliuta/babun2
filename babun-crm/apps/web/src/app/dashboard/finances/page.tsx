"use client";

// /finances — finance_transactions ledger view.
//
// Phase C of the redesign (see /root/.claude/plans/story-moonlit-biscuit.md).
// Replaces the legacy localStorage-backed FinanceTabs/useFinanceData
// page with a read-only view fed entirely by Supabase:
//   • brigade-chip multi-select + period switcher + Доход/Расход banner
//     with inline Прибыль · Ожидаемая · Долг
//   • per-brigade «По бригадам» breakdown for the active range
//   • accounts list with computed balances
//   • day-grouped transactions feed
//   • sticky +Доход / +Расход / +Перевод bar (action sheets land in Phase D)

import { useMemo, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useTeams,
  useTenantId,
} from "@/components/layout/DashboardClientLayout";
import FinanceHeader from "@/components/finance/FinanceHeader";
import AccountsBlock from "@/components/finance/AccountsBlock";
import BrigadeBreakdownBlock from "@/components/finance/BrigadeBreakdownBlock";
import TransactionsFeed from "@/components/finance/TransactionsFeed";
import {
  useAccounts,
  useFinanceTransactions,
} from "@/lib/finance/hooks";
import {
  getPeriodRange,
  type PeriodKind,
} from "@/lib/finance/period";
import { computePeriodTotals } from "@/lib/finance/ledger-compute";

export default function FinancesPage() {
  const tenantId = useTenantId();
  const { teams } = useTeams();
  const { appointments } = useAppointments();

  const [period, setPeriod] = useState<PeriodKind>("month");
  const [selectedBrigadeIds, setSelectedBrigadeIds] = useState<string[]>([]);

  const range = useMemo(() => getPeriodRange({ kind: period }), [period]);

  const listOpts = useMemo(
    () => (selectedBrigadeIds.length > 0 ? { brigadeIds: selectedBrigadeIds } : {}),
    [selectedBrigadeIds],
  );

  const { accounts } = useAccounts(tenantId);
  const { transactions } = useFinanceTransactions(tenantId, range, listOpts);

  const totals = useMemo(
    () =>
      computePeriodTotals({
        transactions,
        appointments,
        brigadeFilter: selectedBrigadeIds,
        fromDate: range.from,
        toDate: range.to,
      }),
    [transactions, appointments, selectedBrigadeIds, range.from, range.to],
  );

  const handleToggleBrigade = useCallback((brigadeId: string) => {
    setSelectedBrigadeIds((prev) =>
      prev.includes(brigadeId)
        ? prev.filter((id) => id !== brigadeId)
        : [...prev, brigadeId],
    );
  }, []);

  const handleResetBrigades = useCallback(() => setSelectedBrigadeIds([]), []);

  const handleBrigadeTap = useCallback((brigadeId: string) => {
    setSelectedBrigadeIds([brigadeId]);
  }, []);

  return (
    <>
      <PageHeader title="Финансы" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] pb-[120px]">
        <FinanceHeader
          teams={teams}
          selectedBrigadeIds={selectedBrigadeIds}
          onToggleBrigade={handleToggleBrigade}
          onResetBrigades={handleResetBrigades}
          period={period}
          onPeriodChange={setPeriod}
          totals={totals}
        />

        <BrigadeBreakdownBlock
          teams={
            selectedBrigadeIds.length === 0
              ? teams
              : teams.filter((t) => selectedBrigadeIds.includes(t.id))
          }
          transactions={transactions}
          onBrigadeTap={handleBrigadeTap}
        />

        <AccountsBlock
          accounts={accounts}
          transactions={transactions}
          teams={teams}
          selectedBrigadeIds={selectedBrigadeIds}
        />

        <TransactionsFeed
          transactions={transactions}
          accounts={accounts}
          teams={teams}
        />
      </div>

      {/* Sticky bottom action bar. Sheets land in Phase D. */}
      <div
        className="fixed left-0 right-0 bottom-[64px] z-30 px-3 pt-2 pb-2 bg-[var(--surface-card)]/95 backdrop-blur border-t border-[var(--separator)]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <ActionButton tone="income" label="+ Доход" />
          <ActionButton tone="expense" label="+ Расход" />
          <ActionButton tone="transfer" label="↔ Перевод" />
        </div>
      </div>
    </>
  );
}

function ActionButton({
  tone,
  label,
}: {
  tone: "income" | "expense" | "transfer";
  label: string;
}) {
  const cls =
    tone === "income"
      ? "bg-[var(--system-green)] text-[var(--label-on-accent)]"
      : tone === "expense"
        ? "bg-[var(--system-red)] text-[var(--label-on-accent)]"
        : "bg-[var(--accent)] text-[var(--label-on-accent)]";
  return (
    <button
      type="button"
      disabled
      title="Действия появятся в следующей фазе"
      className={`flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold opacity-90 disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
