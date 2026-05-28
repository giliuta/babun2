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
      if (alive.current) setTransactions((prev) => [tx, ...prev]);
      return tx;
    },
    [tenantId],
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
      if (alive.current) setTransactions((prev) => [destination, source, ...prev]);
    },
    [tenantId],
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
