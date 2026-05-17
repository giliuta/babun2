"use client";

// Beta #47 (CRM Core brief) — Финансы block on the client card.
//
// Was a 3-row LTV / последний визит / долг summary; the brief asked
// for а полную карточку: LTV, средний чек, последняя оплата, долг,
// история транзакций. Each pixel here is read-only — deeper editing
// happens on /dashboard/finances?client_id=X (the «Подробнее» link).
//
// Transaction list reads directly off the appointments array — paid
// + completed only, last-N. That keeps us off the finance_transactions
// ledger until the cross-tenant repository layer is fully wired
// (STORY-042 follow-up); the data is the same modulo the auto-sync
// trigger, just sourced one hop earlier.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowUpRight, TrendingUp, Calendar, Star } from "@babun/shared/icons";
import type { Appointment } from "@babun/shared/local/appointments";
import { getPaidAmount } from "@babun/shared/local/appointments";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  loadLoyalty,
  tierForVisits,
  type LoyaltySettings,
} from "@babun/shared/local/loyalty";
import ClientCard from "../ClientCard";

interface FinanceBlockProps {
  clientId: string;
  stats: ClientStats | undefined;
  appointments: Appointment[];
}

interface PaidVisit {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method?: string; // cash/card/other/transfer (from payment_method)
}

const HISTORY_LIMIT = 5;

export default function FinanceBlock({
  clientId,
  stats,
  appointments,
}: FinanceBlockProps) {
  const ltv = Math.round(stats?.totalSpent ?? 0);
  const debt = Math.round(stats?.debt ?? 0);
  const lastVisit = stats?.lastVisitDate ?? "";

  // Paid + completed visits sorted recent-first. We use the explicit
  // payment_status when present; legacy rows without the column fall
  // back to «status=completed AND payment !== null».
  const paidVisits: PaidVisit[] = useMemo(() => {
    return appointments
      .filter((a) => {
        if (a.client_id !== clientId) return false;
        if (a.status !== "completed") return false;
        const ps = a.payment_status;
        if (ps === "paid" || ps === "partial") return true;
        // Legacy fallback for rows older than the v577 wiring.
        return ps === undefined && a.payment !== null;
      })
      .map((a) => ({
        id: a.id,
        date: a.date,
        amount: getPaidAmount(a) || a.total_amount,
        method: a.payment_method,
      }))
      .sort((x, y) => y.date.localeCompare(x.date));
  }, [appointments, clientId]);

  const lastPaymentDate = paidVisits[0]?.date ?? "";
  const avgTicket =
    paidVisits.length > 0
      ? Math.round(
          paidVisits.reduce((s, v) => s + v.amount, 0) / paidVisits.length,
        )
      : 0;

  // Beta #53 (CRM Core brief) — show the loyalty tier the client
  // has reached. Reads settings on mount + listens for the
  // babun:loyalty-changed event so editing tiers in Settings
  // reflects in the open card without a reload.
  const [loyalty, setLoyalty] = useState<LoyaltySettings | null>(null);
  useEffect(() => {
    setLoyalty(loadLoyalty());
    const onChange = () => setLoyalty(loadLoyalty());
    window.addEventListener("babun:loyalty-changed", onChange);
    return () => window.removeEventListener("babun:loyalty-changed", onChange);
  }, []);
  const tier = loyalty
    ? tierForVisits(stats?.visits ?? 0, loyalty)
    : null;

  return (
    <ClientCard kind="finance" title="Финансы">
      <div className="px-4 py-3 space-y-2">
        <Row
          icon={<Wallet size={14} strokeWidth={2.2} />}
          label="LTV"
          value={ltv > 0 ? `€${ltv.toLocaleString("ru-RU")}` : "—"}
          tone="default"
        />
        <Row
          icon={<TrendingUp size={14} strokeWidth={2.2} />}
          label="Средний чек"
          value={avgTicket > 0 ? formatEUR(avgTicket) : "—"}
          tone="default"
        />
        <Row
          icon={<Calendar size={14} strokeWidth={2.2} />}
          label="Последняя оплата"
          value={lastPaymentDate ? formatVisitDate(lastPaymentDate) : "—"}
          tone="default"
        />
        <Row
          label="Последний визит"
          value={lastVisit ? formatVisitDate(lastVisit) : "—"}
          tone="default"
        />
        {debt > 0 && <Row label="Долг" value={formatEUR(debt)} tone="bad" />}

        {tier && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-[10px] bg-[rgba(255,204,0,0.10)]">
            <Star
              size={14}
              strokeWidth={2.2}
              className="text-[#B78600] shrink-0"
            />
            <span className="flex-1 text-[13px] font-semibold text-[#B78600]">
              {tier.label}
            </span>
            <span className="text-[13px] font-bold text-[#B78600] tabular-nums">
              −{tier.percent}%
            </span>
          </div>
        )}

        {paidVisits.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[var(--separator)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)] mb-1.5">
              История транзакций
            </div>
            <ul className="space-y-1">
              {paidVisits.slice(0, HISTORY_LIMIT).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 text-[12px] tabular-nums"
                >
                  <span className="flex-1 truncate text-[var(--label-secondary)]">
                    {formatVisitDate(v.date)}
                    {v.method ? ` · ${methodLabel(v.method)}` : ""}
                  </span>
                  <span className="font-semibold text-[var(--system-green)]">
                    +{formatEUR(v.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {paidVisits.length > HISTORY_LIMIT && (
              <div className="text-[11px] text-[var(--label-tertiary)] mt-1">
                + ещё {paidVisits.length - HISTORY_LIMIT} оплат
              </div>
            )}
          </div>
        )}

        <Link
          href={`/dashboard/finances?client_id=${clientId}`}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--accent)] text-[13px] font-semibold active:bg-[var(--fill-secondary)]"
        >
          Подробнее
          <ArrowUpRight size={13} strokeWidth={2.5} />
        </Link>
      </div>
    </ClientCard>
  );
}

function methodLabel(method: string): string {
  switch (method) {
    case "cash":
      return "нал";
    case "card":
      return "карта";
    case "transfer":
      return "перевод";
    case "other":
      return "сплит";
    default:
      return method;
  }
}

function Row({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone: "default" | "bad";
}) {
  const valCls =
    tone === "bad"
      ? "text-[var(--system-red)]"
      : "text-[var(--label)]";
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className="shrink-0 text-[var(--label-tertiary)]">{icon}</span>
      )}
      <span className="flex-1 text-[13px] text-[var(--label-secondary)]">
        {label}
      </span>
      <span className={`text-[14px] font-bold tabular-nums ${valCls}`}>
        {value}
      </span>
    </div>
  );
}

function formatVisitDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
