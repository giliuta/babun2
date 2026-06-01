"use client";

// Accounts — compact horizontal cards (scale for many/few). Each card
// = one money bucket with its computed balance. Section header shows
// the combined balance of the visible accounts + a «+» to create one.
// Brigade subtitle shows only when more than one brigade is in view.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account, AccountKind } from "@babun/shared/local/finance/account";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Team } from "@babun/shared/local/masters";
import { computeAccountBalance } from "@/lib/finance/ledger-compute";

const KIND_ICON: Record<AccountKind, string> = {
  cash: "💵",
  card: "💳",
  bank: "🏦",
  other: "📦",
};

interface AccountsBlockProps {
  accounts: Account[];
  /** ALL transactions for the tenant in the active range — for balances. */
  transactions: FinanceTransaction[];
  teams: Team[];
  selectedBrigadeIds: string[];
  /** Tap on a card — opens detail / actions in a later phase. */
  onAccountTap?: (account: Account) => void;
  onAddAccount?: () => void;
}

export default function AccountsBlock({
  accounts,
  transactions,
  teams,
  selectedBrigadeIds,
  onAccountTap,
  onAddAccount,
}: AccountsBlockProps) {
  const visible =
    selectedBrigadeIds.length === 0
      ? accounts
      : accounts.filter((a) => selectedBrigadeIds.includes(a.brigade_id));

  const teamName = (id: string): string =>
    teams.find((t) => t.id === id)?.name ?? id;
  const showBrigade = selectedBrigadeIds.length !== 1;

  const balances = visible.map((a) => ({
    a,
    bal: computeAccountBalance(a, transactions),
  }));
  const total = balances.reduce((s, x) => s + x.bal, 0);

  return (
    <div className="px-3 pt-3">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Счета
          {visible.length > 0 && (
            <span className="ml-1.5 normal-case tracking-normal text-[var(--label)] font-bold tabular-nums">
              {formatEUR(total)}
            </span>
          )}
        </span>
        {onAddAccount && (
          <button
            type="button"
            onClick={onAddAccount}
            aria-label="Добавить счёт"
            className="w-7 h-7 flex items-center justify-center rounded-[8px] bg-[var(--surface-card)] text-[var(--accent)] text-[20px] leading-none shadow-[0_0_0_1px_var(--separator)] active:scale-95 transition"
          >
            +
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-[12px] px-3 py-4 text-[12px] text-[var(--label-tertiary)] text-center">
          {onAddAccount
            ? "Нет счетов — создайте первый кнопкой +"
            : "Нет счетов в выбранных бригадах"}
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          {balances.map(({ a, bal }) => {
            const icon = a.icon || KIND_ICON[a.kind] || "💼";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAccountTap?.(a)}
                className="flex-shrink-0 w-[140px] text-left bg-[var(--surface-card)] rounded-[14px] p-3 shadow-[0_1px_2px_rgba(10,15,25,0.05),0_0_0_1px_var(--separator)] active:scale-[0.98] transition"
              >
                <span className="inline-flex w-[30px] h-[30px] rounded-[9px] bg-[var(--fill-quaternary)] items-center justify-center text-[16px] mb-2">
                  {icon}
                </span>
                <div className="text-[12.5px] text-[var(--label-secondary)] truncate">
                  {a.name}
                </div>
                {showBrigade && (
                  <div className="text-[10.5px] text-[var(--label-tertiary)] truncate">
                    {teamName(a.brigade_id)}
                  </div>
                )}
                <div
                  className={`text-[18px] font-bold tabular-nums tracking-tight mt-0.5 ${
                    bal < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
                  }`}
                >
                  {formatEUR(bal)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
