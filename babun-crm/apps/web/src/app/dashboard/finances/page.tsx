"use client";

// /finances — finance_transactions ledger view.
//
// Single-team scope + overview (Счета · Доход/Расход · Долги|Прибыль) +
// inline accounts panel + header-less feed + analytics popup. One
// «Операция» entry (income/expense, templates, receipt). Reuses the
// Supabase hooks in lib/finance/hooks + ledger-compute.

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
import AnalyticsSheet from "@/components/finance/AnalyticsSheet";
import DebtorsList from "@/components/finance/DebtorsList";
import ProfitPanel from "@/components/finance/ProfitPanel";
import TransactionsFeed from "@/components/finance/TransactionsFeed";
import OperationSheet from "@/components/finance/OperationSheet";
import TransferSheet from "@/components/finance/TransferSheet";
import TransactionPopup from "@/components/finance/TransactionPopup";
import InvoiceSheet from "@/components/finance/InvoiceSheet";
import AddAccountSheet from "@/components/finance/AddAccountSheet";
import {
  useAccounts,
  useAccountBalances,
  useFinanceTransactions,
  useFinanceCategories,
  useFinanceTemplates,
} from "@/lib/finance/hooks";
import {
  getPeriodRange,
  type PeriodKind,
  type PeriodRange,
} from "@/lib/finance/period";
import { computePeriodTotals } from "@/lib/finance/ledger-compute";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Account } from "@babun/shared/local/finance/account";

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

  const {
    accounts,
    add: addAccount,
    update: updateAccount,
    close: closeAccount,
  } = useAccounts(tenantId);
  const { deltas: balanceDeltas, refresh: refreshBalances } =
    useAccountBalances(tenantId);
  const {
    transactions,
    add: addTransaction,
    remove: removeTransaction,
    transfer: createTransferTx,
    refresh: refreshTransactions,
  } = useFinanceTransactions(tenantId, range, listOpts);
  // All-team transactions in the period — only the analytics «по бригадам»
  // section needs the cross-team view; everything else stays scoped.
  const { transactions: allTeamTx } = useFinanceTransactions(tenantId, range, {});
  const { categories, add: addCategory } = useFinanceCategories(tenantId);
  const { templates } = useFinanceTemplates(tenantId);

  // Templates relevant to the active scope: global ones + this brigade's.
  const scopedTemplates = useMemo(
    () => templates.filter((t) => !t.brigade_id || t.brigade_id === scopeTeamId),
    [templates, scopeTeamId],
  );

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

  // Re-filter to the active team before any per-tx breakdown. The raw
  // list can carry other teams' rows (transfer legs, optimistic adds),
  // which is why computePeriodTotals re-filters too — the profit panel
  // must scope identically so its totals match the overview «Прибыль».
  const scopedTx = useMemo(
    () =>
      brigadeFilter.length > 0
        ? transactions.filter(
            (t) => t.team_id && brigadeFilter.includes(t.team_id),
          )
        : transactions,
    [transactions, brigadeFilter],
  );

  const scopedAccounts = useMemo(
    () =>
      scopeTeamId
        ? accounts.filter((a) => a.brigade_id === scopeTeamId)
        : accounts,
    [accounts, scopeTeamId],
  );
  // All-time running balance per account (opening + every movement ever),
  // independent of the viewed period. See useAccountBalances.
  const accountBalances = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) {
      m.set(a.id, a.opening_balance + (balanceDeltas.get(a.id) ?? 0));
    }
    return m;
  }, [accounts, balanceDeltas]);
  const acctTotal = useMemo(
    () =>
      scopedAccounts.reduce(
        (s, a) => s + (accountBalances.get(a.id) ?? a.opening_balance),
        0,
      ),
    [scopedAccounts, accountBalances],
  );

  // Σ refunds already issued against each income, to cap further refunds.
  const refundedByTx = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === "refund" && t.refund_of_id) {
        m.set(t.refund_of_id, (m.get(t.refund_of_id) ?? 0) + Math.abs(t.amount));
      }
    }
    return m;
  }, [transactions]);

  const feedTx = useMemo(() => {
    if (homeView === "income")
      return scopedTx.filter(
        (t) => t.type === "income" || t.type === "refund",
      );
    if (homeView === "expense")
      return scopedTx.filter((t) => t.type === "expense");
    return scopedTx;
  }, [scopedTx, homeView]);

  const toggleView = useCallback(
    (v: HomeView) => setHomeView((prev) => (prev === v ? "all" : v)),
    [],
  );

  // ─── Action sheets state ────────────────────────────────────────────
  const [operationOpen, setOperationOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [popupTx, setPopupTx] = useState<FinanceTransaction | null>(null);
  const [invoiceTx, setInvoiceTx] = useState<FinanceTransaction | null>(null);
  const [accountSheet, setAccountSheet] = useState<"new" | Account | null>(null);

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
      await refreshBalances();
    },
    [addTransaction, refreshBalances],
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
        rightContent={
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            aria-label="Аналитика"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-tertiary)] transition press-scale"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3v16a2 2 0 0 0 2 2h16" />
              <rect x="7" y="11" width="3" height="6" rx="1" />
              <rect x="13" y="7" width="3" height="10" rx="1" />
            </svg>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] pb-[120px]">
        <div className="max-w-3xl mx-auto">
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
          onTapProfit={() => toggleView("profit")}
        />

        {homeView === "accounts" ? (
          <AccountsPanel
            accounts={scopedAccounts}
            balances={accountBalances}
            onAccountTap={(a) => setAccountSheet(a)}
            onTransfer={() => setTransferOpen(true)}
            onAddAccount={() => setAccountSheet("new")}
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
        ) : homeView === "profit" ? (
          <ProfitPanel
            transactions={scopedTx}
            categories={categories}
            services={services}
            appointments={appointments}
          />
        ) : (
          <TransactionsFeed
            transactions={feedTx}
            accounts={accounts}
            teams={teams}
            categories={categories}
            clients={clients}
            appointments={appointments}
            services={services}
            onTxTap={setPopupTx}
            onClientTap={(id) => router.push(`/dashboard/clients/${id}`)}
          />
        )}
        </div>
      </div>

      {/* Sticky bottom action bar — one «Операция» entry */}
      <div
        className="fixed left-0 right-0 bottom-[64px] z-30 px-3 pt-2 pb-2 bg-[var(--surface-card)]/95 backdrop-blur border-t border-[var(--separator)]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => setOperationOpen(true)}
            className="w-full h-12 rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[16px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <span aria-hidden className="text-[20px] leading-none">＋</span> Операция
          </button>
        </div>
      </div>

      {analyticsOpen && (
        <AnalyticsSheet
          open
          onClose={() => setAnalyticsOpen(false)}
          scopeLabel={teams.find((t) => t.id === scopeTeamId)?.name ?? "Все"}
          range={range}
          totals={totals}
          acctTotal={acctTotal}
          scopedTx={transactions}
          allTeamTx={allTeamTx}
          teams={teams}
          categories={categories}
          services={services}
          appointments={appointments}
          onBrigadeTap={(id) => {
            setScopeTeamId(id);
            setAnalyticsOpen(false);
          }}
        />
      )}

      {operationOpen && (
        <OperationSheet
          open
          onClose={() => setOperationOpen(false)}
          tenantId={tenantId}
          teamId={scopeTeamId}
          accounts={scopedAccounts}
          categories={categories}
          templates={scopedTemplates}
          appointments={appointments}
          clients={clients}
          services={services}
          onAddCategory={addCategory}
          onSubmit={async (draft) => {
            await addTransaction(draft);
            await refreshBalances();
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
            await refreshBalances();
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
          alreadyRefunded={refundedByTx.get(popupTx.id) ?? 0}
          onDelete={async (tx) => {
            await removeTransaction(tx.id);
            await refreshBalances();
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
          clientName={
            clients.find((c) => c.id === invoiceTx.client_id)?.full_name ?? null
          }
          onIssued={() => {
            void refreshTransactions();
          }}
        />
      )}

      {accountSheet && (
        <AddAccountSheet
          open
          onClose={() => setAccountSheet(null)}
          teams={teams}
          defaultBrigadeId={scopeTeamId ?? undefined}
          account={accountSheet === "new" ? undefined : accountSheet}
          onSubmit={async (draft) => {
            await addAccount(draft);
          }}
          onUpdate={async (id, patch) => {
            await updateAccount(id, patch);
          }}
          onDelete={async (id) => {
            await closeAccount(id);
          }}
        />
      )}
    </>
  );
}

// Entry is now a single «Операция» button → OperationSheet (segment inside).
