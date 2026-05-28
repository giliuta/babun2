"use client";

// /finances — finance_transactions ledger view.
//
// Phases C + D of the redesign (see /root/.claude/plans/story-moonlit-biscuit.md).
// Replaces the legacy localStorage-backed FinanceTabs/useFinanceData
// stack with a clean ledger view fed entirely by Supabase, plus the
// write-side action sheets (+Доход / +Расход / +Перевод) and the
// transaction detail popup (Удалить / Создать возврат).

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
import AddTransactionSheet from "@/components/finance/AddTransactionSheet";
import TransferSheet from "@/components/finance/TransferSheet";
import TransactionPopup from "@/components/finance/TransactionPopup";
import {
  useAccounts,
  useFinanceTransactions,
  useFinanceTemplates,
  useFinanceCategories,
} from "@/lib/finance/hooks";
import { getPeriodRange, type PeriodKind } from "@/lib/finance/period";
import { computePeriodTotals } from "@/lib/finance/ledger-compute";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";

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
  const {
    transactions,
    add: addTransaction,
    remove: removeTransaction,
    transfer: createTransferTx,
  } = useFinanceTransactions(tenantId, range, listOpts);
  const { templates } = useFinanceTemplates(tenantId);
  const { categories } = useFinanceCategories(tenantId);

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

  // ─── Action sheets state ────────────────────────────────────────────
  const [addKind, setAddKind] = useState<"income" | "expense" | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [popupTx, setPopupTx] = useState<FinanceTransaction | null>(null);

  const defaultBrigadeId =
    selectedBrigadeIds.length === 1 ? selectedBrigadeIds[0] : undefined;

  const handleRefund = useCallback(
    async (tx: FinanceTransaction, amount: number) => {
      await addTransaction({
        type: "refund",
        amount: -Math.abs(amount),
        account_id: tx.account_id,
        team_id: tx.team_id,
        category_id: tx.category_id,
        payment_method: tx.payment_method,
        refund_of_id: tx.id,
        notes: `Возврат по операции от ${tx.occurred_on}`,
      });
    },
    [addTransaction],
  );

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
          onTxTap={setPopupTx}
        />
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="fixed left-0 right-0 bottom-[64px] z-30 px-3 pt-2 pb-2 bg-[var(--surface-card)]/95 backdrop-blur border-t border-[var(--separator)]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <ActionButton
            tone="income"
            label="+ Доход"
            onClick={() => setAddKind("income")}
          />
          <ActionButton
            tone="expense"
            label="+ Расход"
            onClick={() => setAddKind("expense")}
          />
          <ActionButton
            tone="transfer"
            label="↔ Перевод"
            onClick={() => setTransferOpen(true)}
            disabled={accounts.length < 2}
          />
        </div>
      </div>

      {addKind && (
        <AddTransactionSheet
          open
          onClose={() => setAddKind(null)}
          kind={addKind}
          tenantId={tenantId}
          accounts={accounts}
          teams={teams}
          categories={categories}
          templates={templates}
          defaultBrigadeId={defaultBrigadeId}
          onSubmit={async (draft) => {
            await addTransaction(draft);
          }}
        />
      )}

      {transferOpen && (
        <TransferSheet
          open
          onClose={() => setTransferOpen(false)}
          accounts={accounts}
          teams={teams}
          onSubmit={async (draft) => {
            await createTransferTx(draft);
          }}
        />
      )}

      {popupTx && (
        <TransactionPopup
          open
          onClose={() => setPopupTx(null)}
          transaction={popupTx}
          accounts={accounts}
          teams={teams}
          categories={categories}
          onDelete={async (tx) => {
            await removeTransaction(tx.id);
          }}
          onRefund={handleRefund}
        />
      )}
    </>
  );
}

function ActionButton({
  tone,
  label,
  onClick,
  disabled,
}: {
  tone: "income" | "expense" | "transfer";
  label: string;
  onClick: () => void;
  disabled?: boolean;
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
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-semibold active:scale-[0.98] disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
