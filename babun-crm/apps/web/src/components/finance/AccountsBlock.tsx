"use client";

// List of accounts with computed balance. Strict per-brigade — the
// account row carries its brigade label inline so the user can scan
// the same icon across brigades.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Account } from "@babun/shared/local/finance/account";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Team } from "@babun/shared/local/masters";
import { computeAccountBalance } from "@/lib/finance/ledger-compute";

interface AccountsBlockProps {
  accounts: Account[];
  /** ALL transactions for the tenant in the active range — used to compute balances. */
  transactions: FinanceTransaction[];
  teams: Team[];
  selectedBrigadeIds: string[];
  /** Tap on account row — opens detail / actions in a later phase. */
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
  const visible = selectedBrigadeIds.length === 0
    ? accounts
    : accounts.filter((a) => selectedBrigadeIds.includes(a.brigade_id));

  const teamName = (id: string): string => {
    const t = teams.find((x) => x.id === id);
    return t?.name ?? id;
  };

  return (
    <div className="px-3 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] mb-1.5">
        Счета
      </div>
      <div className="bg-[var(--surface-card)] rounded-[12px] overflow-hidden">
        {visible.map((a, idx) => {
          const balance = computeAccountBalance(a, transactions);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onAccountTap?.(a)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-[var(--fill-quaternary)] transition-colors ${
                idx > 0 ? "border-t border-[var(--separator)]" : ""
              }`}
            >
              <span className="text-[18px] leading-none w-6 text-center">
                {a.icon ?? "💵"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[var(--label)] truncate">{a.name}</div>
                <div className="text-[11px] text-[var(--label-tertiary)] truncate">
                  {teamName(a.brigade_id)}
                </div>
              </div>
              <span
                className={`text-[14px] font-semibold tabular-nums flex-shrink-0 ${
                  balance < 0
                    ? "text-[var(--system-red)]"
                    : "text-[var(--label)]"
                }`}
              >
                {formatEUR(balance)}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-[var(--label-tertiary)] text-center">
            Нет счетов в выбранных бригадах
          </div>
        )}
        {onAddAccount && (
          <button
            type="button"
            onClick={onAddAccount}
            className={`w-full h-10 text-[13px] font-semibold text-[var(--accent)] border-dashed border border-[var(--separator)] rounded-[10px] mt-1.5 active:scale-[0.98] transition`}
          >
            + Счёт
          </button>
        )}
      </div>
    </div>
  );
}
