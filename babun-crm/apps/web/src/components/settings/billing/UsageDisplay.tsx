"use client";

// STORY-052 G5 — usage display. Four progress bars (clients,
// appointments_month, team_members, sms_month). Bars turn orange
// when usage ≥ 80%, red when ≥ 100%. "Безлимит" label substitutes
// for the digit when isUnlimited().

import { isUnlimited, type QuotaSummary, type UsageCounts } from "./types";

interface Props {
  quotas: QuotaSummary;
  usage: UsageCounts;
}

const ROWS: Array<{
  key: keyof QuotaSummary;
  label: string;
  unit: string;
}> = [
  { key: "clients", label: "Клиенты", unit: "" },
  { key: "appointments_month", label: "Записи в этом месяце", unit: "" },
  { key: "team_members", label: "Команда (включая приглашения)", unit: "" },
  { key: "sms_month", label: "SMS в этом месяце", unit: "" },
];

export default function UsageDisplay({ quotas, usage }: Props) {
  return (
    <section className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-3">
      <header>
        <h2 className="text-[17px] font-semibold text-[var(--label)]">
          Использование
        </h2>
      </header>
      <div className="space-y-3">
        {ROWS.map((row) => (
          <UsageBar
            key={row.key}
            label={row.label}
            current={usage[row.key]}
            limit={quotas[row.key]}
            unit={row.unit}
          />
        ))}
      </div>
    </section>
  );
}

function UsageBar({
  label,
  current,
  limit,
  unit,
}: {
  label: string;
  current: number;
  limit: number;
  unit: string;
}) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const tone =
    unlimited
      ? "bg-[var(--system-green,#34C759)]"
      : pct >= 100
        ? "bg-[var(--system-red,#FF3B30)]"
        : pct >= 80
          ? "bg-[var(--system-orange,#FF9500)]"
          : "bg-[var(--system-blue)]";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-[var(--label)]">{label}</span>
        <span className="text-[var(--label-secondary)] tabular-nums">
          {unlimited ? (
            `${formatNum(current)} ${unit} · Безлимит`
          ) : (
            `${formatNum(current)} / ${formatNum(limit)} ${unit}`
          )}
        </span>
      </div>
      <div className="h-1.5 mt-1.5 rounded-full bg-[var(--fill-primary)] overflow-hidden">
        <div
          className={`h-full transition-all ${tone}`}
          style={{ width: unlimited ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  // Localised thousand separator; "1 000" reads better in RU than "1,000".
  return n.toLocaleString("ru-RU");
}
