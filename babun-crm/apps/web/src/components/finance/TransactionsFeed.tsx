"use client";

// Day-grouped feed of finance_transactions (mockup «Вариант 3», Bumpix-style
// in our tokens): each day shows its net; each row = colored left bar (by
// type) + category icon + «время · контрагент» over the description, amount
// on the right. Tap → detail popup.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { Account } from "@babun/shared/local/finance/account";
import type { Team } from "@babun/shared/local/masters";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import type { Client } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
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
  categories: FinanceCategory[];
  clients: Client[];
  appointments: Appointment[];
  onTxTap?: (tx: FinanceTransaction) => void;
}

export default function TransactionsFeed({
  transactions,
  accounts,
  teams,
  categories,
  clients,
  appointments,
  onTxTap,
}: TransactionsFeedProps) {
  const groups = groupByDay(transactions);
  if (groups.length === 0) {
    return (
      <div className="px-3 pt-3">
        <div className="bg-[var(--surface-card)] rounded-[12px] px-3 py-6 text-center text-[12px] text-[var(--label-tertiary)]">
          Нет операций за выбранный период
        </div>
      </div>
    );
  }

  const accountName = (id: string | null): string =>
    id ? accounts.find((a) => a.id === id)?.name ?? "" : "";
  const teamName = (id: string | null): string =>
    id ? teams.find((t) => t.id === id)?.name ?? "" : "";
  const clientName = (id: string | null): string =>
    id ? clients.find((c) => c.id === id)?.full_name ?? "" : "";
  const apptTime = (id: string | null): string =>
    id ? appointments.find((a) => a.id === id)?.time_start ?? "" : "";

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.date} className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between px-3.5 py-2">
              <span className="text-[12px] font-semibold text-[var(--label-tertiary)]">
                {dayLabel(g.date)}
              </span>
              <span
                className={`text-[13px] font-bold tabular-nums ${
                  g.net < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
                }`}
              >
                {g.net >= 0 ? "+" : "−"}
                {formatEUR(Math.abs(g.net))}
              </span>
            </div>

            {g.transactions.map((tx) => {
              const isIn = tx.type === "income" || tx.type === "refund";
              const isEx = tx.type === "expense";
              const isTr = tx.type === "transfer";

              const cat = tx.category_id
                ? categories.find((c) => c.id === tx.category_id)
                : null;
              const emoji =
                cat?.icon ||
                (tx.payment_method ? PAYMENT_EMOJI[tx.payment_method] : null) ||
                (isTr ? "⇄" : "•");
              const desc =
                cat?.name ||
                tx.notes ||
                (isTr ? "Перевод" : isEx ? "Расход" : "Поступление");

              // context line: время · контрагент (income) / комментарий (expense)
              let ctx = "";
              if (isIn) {
                ctx = [apptTime(tx.appointment_id), clientName(tx.client_id)]
                  .filter(Boolean)
                  .join(" · ");
              } else if (isEx && cat && tx.notes) {
                ctx = tx.notes;
              }
              if (!ctx) {
                ctx = [accountName(tx.account_id), teamName(tx.team_id)]
                  .filter(Boolean)
                  .join(" · ");
              }

              const barColor = isIn
                ? "var(--system-green)"
                : isEx
                  ? "var(--system-red)"
                  : "var(--label-quaternary)";
              const descCls = isIn
                ? "text-[var(--system-green)] font-semibold"
                : isEx
                  ? "text-[var(--label)] font-medium"
                  : "text-[var(--label-secondary)] font-medium";
              const amountCls = isIn
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
                  className="w-full flex items-center gap-0 pr-3.5 text-left border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)] transition-colors min-h-[58px]"
                >
                  <span
                    className="w-[3px] self-stretch flex-none my-[9px] rounded-r-[2px]"
                    style={{ background: barColor }}
                  />
                  <span className="w-[34px] h-[34px] rounded-[9px] bg-[var(--fill-quaternary)] flex items-center justify-center text-[16px] flex-none ml-2.5 mr-3">
                    {emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    {ctx && (
                      <div className="text-[12px] text-[var(--label-tertiary)] truncate">
                        {ctx}
                      </div>
                    )}
                    <div className={`text-[15px] truncate ${descCls}`}>
                      {desc}
                    </div>
                  </div>
                  <span className={`text-[16px] font-bold tabular-nums flex-none ${amountCls}`}>
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

const RU_MONTHS_FULL = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((t0.getTime() - d.getTime()) / 86400000);
  const date = `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
  if (diff === 0) return `Сегодня · ${date}`;
  if (diff === 1) return `Вчера · ${date}`;
  return date;
}
