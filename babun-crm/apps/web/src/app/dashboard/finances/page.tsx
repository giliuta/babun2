"use client";

// /finances — finance_transactions ledger view.
//
// Home redesign (STORY-062 Slice 1): single-team scope + overview
// (Счета · Доход/Расход · Долги|Прибыль) + inline accounts panel +
// header-less feed. Reuses the existing Supabase hooks + ledger-compute;
// entry sheets stay wired (Slice 2 replaces them with one «Операция»).

import { useMemo, useState, useCallback, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useRouter } from "next/navigation";
import { Settings } from "@babun/shared/icons";
import {
  useAppointments,
  useClients,
  useServices,
  useTeams,
  useTenantId,
} from "@/components/layout/DashboardClientLayout";
import FinanceOverview, { type HomeView } from "@/components/finance/FinanceOverview";
import AccountsPanel from "@/components/finance/AccountsPanel";
import DebtorsList from "@/components/finance/DebtorsList";
import TransactionsFeed from "@/components/finance/TransactionsFeed";
import OperationSheet from "@/components/finance/OperationSheet";
import TransferSheet from "@/components/finance/TransferSheet";
import TransactionPopup from "@/components/finance/TransactionPopup";
import InvoiceSheet from "@/components/finance/InvoiceSheet";
import AddAccountSheet from "@/components/finance/AddAccountSheet";
import {
  useAccounts,
  useFinanceTransactions,
  useFinanceCategories,
} from "@/lib/finance/hooks";
import {
  getPeriodRange,
  type PeriodKind,
  type PeriodRange,
} from "@/lib/finance/period";
import {
  computePeriodTotals,
  computeAccountBalance,
} from "@/lib/finance/ledger-compute";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";

export default function FinancesPage() {
  const tenantId = useTenantId();
  const { teams } = useTeams();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const { services } = useServices();
  const router = useRouter();

  // ─── Scope: one active team at a time (mockup Север/Юг) ─────────────
  const [scopeTeamId, setScopeTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (scopeTeamId === null && teams.length > 0) setScopeTeamId(teams[0].id);
  }, [teams, scopeTeamId]);

  const [period, setPeriod] = useState<PeriodKind>("month");
  const [customRange, setCustomRange] = useState<PeriodRange | null>(null);
  const [homeView, setHomeView] = useState<HomeView>("all");

  const range = useMemo(
    () =>
      period === "custom" && customRange
        ? getPeriodRange({ kind: "custom", custom: customRange })
        : getPeriodRange({ kind: period }),
    [period, customRange],
  );
  const handleCustomRange = useCallback((r: PeriodRange) => {
    setCustomRange(r);
    setPeriod("custom");
  }, []);

  const brigadeFilter = useMemo(
    () => (scopeTeamId ? [scopeTeamId] : []),
    [scopeTeamId],
  );
  const listOpts = useMemo(
    () => (scopeTeamId ? { brigadeIds: [scopeTeamId] } : {}),
    [scopeTeamId],
  );

  const { accounts, add: addAccount } = useAccounts(tenantId);
  const {
    transactions,
    add: addTransaction,
    remove: removeTransaction,
    transfer: createTransferTx,
    refresh: refreshTransactions,
  } = useFinanceTransactions(tenantId, range, listOpts);
  const { categories } = useFinanceCategories(tenantId);

  const totals = useMemo(
    () =>
      computePeriodTotals({
        transactions,
        appointments,
        brigadeFilter,
        fromDate: range.from,
        toDate: range.to,
      }),
    [transactions, appointments, brigadeFilter, range.from, range.to],
  );

  const scopedAccounts = useMemo(
    () =>
      scopeTeamId
        ? accounts.filter((a) => a.brigade_id === scopeTeamId)
        : accounts,
    [accounts, scopeTeamId],
  );
  const acctTotal = useMemo(
    () =>
      scopedAccounts.reduce(
        (s, a) => s + computeAccountBalance(a, transactions),
        0,
      ),
    [scopedAccounts, transactions],
  );

  const feedTx = useMemo(() => {
    if (homeView === "income")
      return transactions.filter(
        (t) => t.type === "income" || t.type === "refund",
      );
    if (homeView === "expense")
      return transactions.filter((t) => t.type === "expense");
    return transactions;
  }, [transactions, homeView]);

  const toggleView = useCallback(
    (v: HomeView) => setHomeView((prev) => (prev === v ? "all" : v)),
    [],
  );

  // ─── Action sheets state ────────────────────────────────────────────
  const [operationOpen, setOperationOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [popupTx, setPopupTx] = useState<FinanceTransaction | null>(null);
  const [invoiceTx, setInvoiceTx] = useState<FinanceTransaction | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);

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
      <PageHeader
        title="Финансы"
        leftContent={
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings/finance")}
            aria-label="Настройки финансов"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)] transition press-scale"
          >
            <Settings size={20} strokeWidth={2} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] pb-[120px]">
        <FinanceOverview
          teams={teams}
          scopeTeamId={scopeTeamId}
          onScopeChange={setScopeTeamId}
          period={period}
          onPeriodChange={setPeriod}
          range={range}
          onCustomRange={handleCustomRange}
          totals={totals}
          acctTotal={acctTotal}
          view={homeView}
          onTapAccounts={() => toggleView("accounts")}
          onTapIncome={() => toggleView("income")}
          onTapExpense={() => toggleView("expense")}
          onTapDebt={() => toggleView("debt")}
        />

        {homeView === "accounts" ? (
          <AccountsPanel
            accounts={scopedAccounts}
            transactions={transactions}
            onTransfer={() => setTransferOpen(true)}
            onAddAccount={() => setAddAccountOpen(true)}
            transferDisabled={accounts.length < 2}
          />
        ) : homeView === "debt" ? (
          <DebtorsList
            appointments={appointments}
            clients={clients}
            teamId={scopeTeamId}
            fromDate={range.from}
            toDate={range.to}
          />
        ) : (
          <TransactionsFeed
            transactions={feedTx}
            accounts={accounts}
            teams={teams}
            onTxTap={setPopupTx}
          />
        )}
      </div>

      {/* Sticky bottom action bar (Slice 1 keeps 3 buttons; Slice 2 → one «Операция») */}
      <div
        className="fixed left-0 right-0 bottom-[64px] z-30 px-3 pt-2 pb-2 bg-[var(--surface-card)]/95 backdrop-blur border-t border-[var(--separator)]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setOperationOpen(true)}
            className="w-full h-12 rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[16px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <span aria-hidden className="text-[20px] leading-none">＋</span> Операция
          </button>
        </div>
      </div>

      {operationOpen && (
        <OperationSheet
          open
          onClose={() => setOperationOpen(false)}
          teamId={scopeTeamId}
          accounts={scopedAccounts}
          categories={categories}
          appointments={appointments}
          clients={clients}
          services={services}
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
          onInvoice={(tx) => {
            setPopupTx(null);
            setInvoiceTx(tx);
          }}
        />
      )}

      {invoiceTx && (
        <InvoiceSheet
          open
          onClose={() => setInvoiceTx(null)}
          transaction={invoiceTx}
          onIssued={() => {
            void refreshTransactions();
          }}
        />
      )}

      {addAccountOpen && (
        <AddAccountSheet
          open
          onClose={() => setAddAccountOpen(false)}
          teams={teams}
          defaultBrigadeId={scopeTeamId ?? undefined}
          onSubmit={async (draft) => {
            await addAccount(draft);
          }}
        />
      )}
    </>
  );
}

// Entry is now a single «Операция» button → OperationSheet (segment inside).
