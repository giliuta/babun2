"use client";

// Inline accounts panel (mockup «Счета»): flat per-team list of accounts
// with balances, then a full-width «⇄ Перевод» and «＋ Новый счёт».
// Accounts passed in are already scoped to the active team.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account, AccountKind } from "@babun/shared/local/finance/account";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import { computeAccountBalance } from "@/lib/finance/ledger-compute";

const KIND_ICON: Record<AccountKind, string> = {
  cash: "💵",
  card: "💳",
  bank: "🏦",
  other: "📦",
};

interface AccountsPanelProps {
  /** Accounts already filtered to the active team. */
  accounts: Account[];
  /** Tenant transactions in range — for balance computation. */
  transactions: FinanceTransaction[];
  onAccountTap?: (account: Account) => void;
  onTransfer: () => void;
  onAddAccount: () => void;
  transferDisabled?: boolean;
}

export default function AccountsPanel({
  accounts,
  transactions,
  onAccountTap,
  onTransfer,
  onAddAccount,
  transferDisabled,
}: AccountsPanelProps) {
  const rows = accounts.map((a) => ({
    a,
    bal: computeAccountBalance(a, transactions),
  }));
  const total = rows.reduce((s, x) => s + x.bal, 0);

  return (
    <div className="px-3 pt-3">
      <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(10,15,25,0.05),0_0_0_1px_var(--separator)]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--separator)]">
          <span className="text-[13px] text-[var(--label-tertiary)]">
            {pluralAccounts(accounts.length)}
          </span>
          <span className="text-[18px] font-bold tabular-nums">
            {formatEUR(total)}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-5 text-center text-[12px] text-[var(--label-tertiary)]">
            Нет счетов — добавьте первый
          </div>
        ) : (
          rows.map(({ a, bal }) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAccountTap?.(a)}
              className="w-full flex items-center gap-3 px-4 py-2 text-left active:bg-[var(--fill-quaternary)] transition-colors"
            >
              <span className="inline-flex w-[34px] h-[34px] rounded-[9px] bg-[var(--fill-quaternary)] items-center justify-center text-[17px] flex-shrink-0">
                {a.icon || KIND_ICON[a.kind] || "💼"}
              </span>
              <span className="flex-1 min-w-0 text-[15px] font-medium truncate">
                {a.name}
              </span>
              <span
                className={`text-[15px] font-bold tabular-nums ${
                  bal < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
                }`}
              >
                {formatEUR(bal)}
              </span>
              <ChevronRight />
            </button>
          ))
        )}

        <div className="px-3 pb-3 pt-2.5 border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={onTransfer}
            disabled={transferDisabled}
            className="w-full h-11 rounded-[12px] bg-[var(--fill-tertiary)] text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99] transition"
          >
            <span aria-hidden>⇄</span> Перевод
          </button>
          <button
            type="button"
            onClick={onAddAccount}
            className="w-full h-10 mt-1.5 text-[15px] font-semibold text-[var(--accent)] inline-flex items-center justify-center gap-1.5 active:opacity-70 transition"
          >
            <span aria-hidden>＋</span> Новый счёт
          </button>
        </div>
      </div>
    </div>
  );
}

function pluralAccounts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "счетов";
  if (mod10 === 1 && mod100 !== 11) word = "счёт";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    word = "счёта";
  return `${n} ${word}`;
}

function ChevronRight() {
  return (
    <svg
      width="8"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--label-tertiary)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
