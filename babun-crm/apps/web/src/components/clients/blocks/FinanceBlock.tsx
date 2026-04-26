"use client";

// STORY-034 — Finance block.  Read-only summary; deeper editing
// happens on /dashboard/finances?client_id=X.  Hidden for the future
// "crew" role (see business-blocks.ts).

import Link from "next/link";
import { Wallet, ArrowUpRight } from "@babun/shared/icons";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { formatEUR } from "@babun/shared/common/utils/money";
import ClientCard from "../ClientCard";

interface FinanceBlockProps {
  clientId: string;
  stats: ClientStats | undefined;
}

export default function FinanceBlock({ clientId, stats }: FinanceBlockProps) {
  const ltv = Math.round(stats?.totalSpent ?? 0);
  const debt = Math.round(stats?.debt ?? 0);
  const lastVisit = stats?.lastVisitDate ?? "";

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
          label="Последний визит"
          value={lastVisit ? formatVisitDate(lastVisit) : "—"}
          tone="default"
        />
        {debt > 0 && (
          <Row label="Долг" value={formatEUR(debt)} tone="bad" />
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
