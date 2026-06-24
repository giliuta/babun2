"use client";

// Standalone hooks for /finances. They live outside DashboardClient-
// Layout so the heavy ledger queries only fire when /finances is
// actually open — the rest of the app doesn't pay for them.

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  listAccounts,
  type AccountDraft,
  insertAccount,
  updateAccount,
  softCloseAccount,
} from "@babun/shared/db/repositories/accounts";
import {
  listTransactionsForRange,
  listAccountBalanceDeltas,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  createTransfer,
  deleteTransfer,
  type ListRangeOptions,
  type TransactionDraft,
  type TransferDraft,
} from "@babun/shared/db/repositories/finance-transactions";
import {
  listFinanceTemplates,
  insertFinanceTemplate,
  updateFinanceTemplate,
  deleteFinanceTemplate,
  type TemplateDraft,
} from "@babun/shared/db/repositories/finance-templates";
import {
  listFinanceCategories,
  insertFinanceCategory,
  updateFinanceCategory,
  deleteFinanceCategory,
  type FinanceCategory,
  type FinanceCategoryKind,
  type FinanceCategoryPatch,
} from "@babun/shared/db/repositories/finance-categories";
import type { Account } from "@babun/shared/local/finance/account";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { FinanceTemplate } from "@babun/shared/local/finance/template";

export interface UseAccountsResult {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (draft: AccountDraft) => Promise<Account>;
  update: (id: string, patch: Partial<AccountDraft>) => Promise<void>;
  close: (id: string) => Promise<void>;
}

export function useAccounts(tenantId: string): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAccounts(getSupabaseBrowser(), tenantId);
      if (alive.current) {
        setAccounts(list);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (draft: AccountDraft) => {
      const acc = await insertAccount(getSupabaseBrowser(), tenantId, draft);
      if (alive.current) setAccounts((prev) => [...prev, acc]);
      return acc;
    },
    [tenantId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<AccountDraft>) => {
      await updateAccount(getSupabaseBrowser(), id, patch);
      if (alive.current) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } as Account : a)));
      }
    },
    [],
  );

  const close = useCallback(async (id: string) => {
    await softCloseAccount(getSupabaseBrowser(), id);
    if (alive.current) setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { accounts, loading, error, refresh, add, update, close };
}

export interface UseAccountBalancesResult {
  /** accountId → all-time signed delta (add to opening_balance). */
  deltas: Map<string, number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * All-time per-account signed deltas, independent of the viewed period —
 * the account balance is a running total of every movement ever, so it
 * must NOT use the period-windowed transaction list. Call refresh()
 * after any ledger mutation to keep balances live.
 */
export function useAccountBalances(tenantId: string): UseAccountBalancesResult {
  const [deltas, setDeltas] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const map = await listAccountBalanceDeltas(getSupabaseBrowser(), tenantId);
      if (alive.current) {
        setDeltas(map);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { deltas, loading, error, refresh };
}

export interface UseFinanceTransactionsResult {
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (draft: TransactionDraft) => Promise<FinanceTransaction>;
  update: (id: string, patch: Partial<TransactionDraft>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  transfer: (t: TransferDraft) => Promise<void>;
  removeTransfer: (groupId: string) => Promise<void>;
}

export function useFinanceTransactions(
  tenantId: string,
  range: { from: string; to: string },
  opts: ListRangeOptions = {},
): UseFinanceTransactionsResult {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Stable key for opts so the effect only re-fires on real changes.
  const optsKey = JSON.stringify(opts);

  // A freshly-written row only belongs in local state if it falls inside
  // the currently-viewed window (date range + team filter). Otherwise an
  // optimistic prepend would show a row the next refetch can't reproduce.
  const inWindow = useCallback(
    (tx: FinanceTransaction): boolean => {
      if (tx.occurred_on < range.from || tx.occurred_on > range.to) return false;
      const bids = opts.brigadeIds;
      if (bids && bids.length > 0 && (!tx.team_id || !bids.includes(tx.team_id)))
        return false;
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, optsKey],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listTransactionsForRange(
        getSupabaseBrowser(),
        tenantId,
        range.from,
        range.to,
        opts,
      );
      if (alive.current) {
        setTransactions(list);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, range.from, range.to, optsKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (draft: TransactionDraft) => {
      const tx = await insertTransaction(getSupabaseBrowser(), tenantId, draft);
      if (alive.current && inWindow(tx)) setTransactions((prev) => [tx, ...prev]);
      return tx;
    },
    [tenantId, inWindow],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TransactionDraft>) => {
      await updateTransaction(getSupabaseBrowser(), id, patch);
      if (alive.current) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? ({ ...t, ...patch } as FinanceTransaction) : t)),
        );
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteTransaction(getSupabaseBrowser(), id);
    if (alive.current) setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const transfer = useCallback(
    async (t: TransferDraft) => {
      const { source, destination } = await createTransfer(getSupabaseBrowser(), tenantId, t);
      if (alive.current) {
        const fresh = [destination, source].filter(inWindow);
        if (fresh.length > 0) setTransactions((prev) => [...fresh, ...prev]);
      }
    },
    [tenantId, inWindow],
  );

  const removeTransfer = useCallback(async (groupId: string) => {
    await deleteTransfer(getSupabaseBrowser(), groupId);
    if (alive.current) {
      setTransactions((prev) => prev.filter((t) => t.transfer_group_id !== groupId));
    }
  }, []);

  return { transactions, loading, error, refresh, add, update, remove, transfer, removeTransfer };
}

export interface UseFinanceTemplatesResult {
  templates: FinanceTemplate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (draft: TemplateDraft) => Promise<FinanceTemplate>;
  update: (id: string, patch: Partial<TemplateDraft>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useFinanceTemplates(tenantId: string): UseFinanceTemplatesResult {
  const [templates, setTemplates] = useState<FinanceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listFinanceTemplates(getSupabaseBrowser(), tenantId);
      if (alive.current) {
        setTemplates(list);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (draft: TemplateDraft) => {
      const tpl = await insertFinanceTemplate(getSupabaseBrowser(), tenantId, draft);
      if (alive.current) setTemplates((prev) => [...prev, tpl]);
      return tpl;
    },
    [tenantId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TemplateDraft>) => {
      await updateFinanceTemplate(getSupabaseBrowser(), id, patch);
      if (alive.current) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? ({ ...t, ...patch } as FinanceTemplate) : t)),
        );
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteFinanceTemplate(getSupabaseBrowser(), id);
    if (alive.current) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, loading, error, refresh, add, update, remove };
}

export function useFinanceCategories(tenantId: string): {
  categories: FinanceCategory[];
  loading: boolean;
  error: string | null;
  add: (
    name: string,
    type: FinanceCategoryKind,
    icon?: string | null,
  ) => Promise<FinanceCategory>;
  update: (id: string, patch: FinanceCategoryPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listFinanceCategories(getSupabaseBrowser(), tenantId)
      .then((list) => { if (alive) { setCategories(list); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tenantId]);

  const add = useCallback(
    async (
      name: string,
      type: FinanceCategoryKind,
      icon?: string | null,
    ): Promise<FinanceCategory> => {
      const cat = await insertFinanceCategory(getSupabaseBrowser(), tenantId, {
        name,
        type,
        icon: icon ?? undefined,
      });
      setCategories((prev) => [cat, ...prev]);
      return cat;
    },
    [tenantId],
  );

  const update = useCallback(
    async (id: string, patch: FinanceCategoryPatch): Promise<void> => {
      await updateFinanceCategory(getSupabaseBrowser(), id, patch);
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteFinanceCategory(getSupabaseBrowser(), id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { categories, loading, error, add, update, remove };
}
