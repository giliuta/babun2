"use client";

// Day-grouped feed of finance_transactions. Each day group shows its
// net total on the right; rows show category/method/account context.
// Tap on a row → opens the detail popup (Phase D — passed via prop).

import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Account } from "@babun/shared/local/finance/account";
import type { Team } from "@babun/shared/local/masters";
import { groupByDay } from "@/lib/finance/ledger-compute";

const PAYMENT_EMOJI: Record<string, string> = {
  cash: "💵",
  card: "💳",
  transfer: "🏦",
  other: "📦",
};

interface TransactionsFeedProps {
  transactions: FinanceTransaction[];
  accounts: Account[];
  teams: Team[];
  onTxTap?: (tx: FinanceTransaction) => void;
}

export default function TransactionsFeed({
  transactions,
  accounts,
  teams,
  onTxTap,
}: TransactionsFeedProps) {
  const groups = groupByDay(transactions);
  if (groups.length === 0) {
    return (
      <div className="px-3 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] mb-1.5">
          Движения
        </div>
        <div className="bg-[var(--surface-card)] rounded-[12px] px-3 py-6 text-center text-[12px] text-[var(--label-tertiary)]">
          Нет движений за выбранный период
        </div>
      </div>
    );
  }

  const accountName = (id: string | null): string => {
    if (!id) return "";
    return accounts.find((a) => a.id === id)?.name ?? "";
  };
  const teamName = (id: string | null): string => {
    if (!id) return "";
    return teams.find((t) => t.id === id)?.name ?? "";
  };

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] mb-1.5">
        Движения
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.date} className="bg-[var(--surface-card)] rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--separator)]">
              <span className="text-[12px] font-semibold text-[var(--label-secondary)]">
                {formatRuDate(g.date)}
              </span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${
                  g.net < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
                }`}
              >
                {formatEUR(g.net)}
              </span>
            </div>
            {g.transactions.map((tx) => {
              const method = tx.payment_method;
              const emoji = method ? PAYMENT_EMOJI[method] : null;
              const subline = [
                accountName(tx.account_id),
                teamName(tx.team_id),
              ]
                .filter(Boolean)
                .join(" · ");
              const isIn = tx.type === "income" || tx.type === "refund";
              const isTr = tx.type === "transfer";
              const isEx = tx.type === "expense";
              const amountColor = isIn
                ? "text-[var(--system-green)]"
                : isEx
                  ? "text-[var(--system-red)]"
                  : "text-[var(--label-secondary)]";
              const sign = isIn || (isTr && tx.amount > 0) ? "+" : "−";
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onTxTap?.(tx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)] transition-colors"
                >
                  <span className="text-[14px] leading-none w-5 text-center">{emoji ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[var(--label)] truncate">
                      {tx.notes || (isTr ? "Перевод" : isEx ? "Расход" : "Поступление")}
                    </div>
                    {subline && (
                      <div className="text-[11px] text-[var(--label-tertiary)] truncate">
                        {subline}
                      </div>
                    )}
                  </div>
                  <span className={`text-[13px] font-semibold tabular-nums ${amountColor}`}>
                    {sign}
                    {formatEUR(Math.abs(tx.amount))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const RU_MONTHS_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек.",
];

function formatRuDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`;
}
