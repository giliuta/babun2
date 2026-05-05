// STORY-070 wave 2 — /admin/stats
//
// Time-series view for the last N days. CSS-driven bars, no chart
// library — keeps the bundle small. Three rows:
//   * Signups by day
//   * SMS sends by day (any status)
//   * Topup revenue by day (EUR)
//
// Window length is selectable via ?days=7|30|90.

import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

interface DayCount {
  day: string;
  count?: number;
  cents?: number;
}
interface StatsResponse {
  days?: number;
  signups_by_day?: DayCount[];
  sms_by_day?: DayCount[];
  topup_eur_by_day?: DayCount[];
  paid_tenants?: number;
  error?: string;
}

const DAY_OPTIONS = [7, 30, 90];

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = (() => {
    const n = parseInt(params.days ?? "30", 10);
    return DAY_OPTIONS.includes(n) ? n : 30;
  })();

  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_stats_summary", {
    p_days: days,
  });
  const s = (data as StatsResponse | null) ?? {};

  const signups = s.signups_by_day ?? [];
  const sms = s.sms_by_day ?? [];
  const topup = s.topup_eur_by_day ?? [];
  const paid = s.paid_tenants ?? 0;

  const totalSignups = signups.reduce((a, b) => a + (b.count ?? 0), 0);
  const totalSms = sms.reduce((a, b) => a + (b.count ?? 0), 0);
  const totalTopupEur = topup.reduce((a, b) => a + (b.cents ?? 0), 0) / 100;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
              Статистика
            </h1>
            <p className="text-[13px] text-[var(--label-secondary)] mt-1">
              Регистрации, MRR и SMS за последние {days} дней.
            </p>
          </div>
          <nav className="flex gap-1 bg-[var(--fill-tertiary)] rounded-[10px] p-0.5">
            {DAY_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`/admin/stats?days=${d}`}
                className={`px-2.5 h-7 inline-flex items-center text-[12px] font-semibold rounded-[8px] tabular-nums ${
                  d === days
                    ? "bg-[var(--surface-card)] text-[var(--label)] shadow-sm"
                    : "text-[var(--label-secondary)]"
                }`}
              >
                {d} дн.
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Регистраций" value={totalSignups} />
          <Tile label="SMS отправлено" value={totalSms} />
          <Tile label="Топапы (€)" value={totalTopupEur.toFixed(2)} />
          <Tile label="Платящих" value={paid} />
        </div>

        <BarSection
          title="Регистрации по дням"
          rows={signups.map((r) => ({ day: r.day, value: r.count ?? 0 }))}
          formatter={(n) => String(n)}
        />

        <BarSection
          title="SMS-отправки по дням"
          rows={sms.map((r) => ({ day: r.day, value: r.count ?? 0 }))}
          formatter={(n) => String(n)}
        />

        <BarSection
          title="Заработок на топапах по дням (€)"
          rows={topup.map((r) => ({
            day: r.day,
            value: (r.cents ?? 0) / 100,
          }))}
          formatter={(n) => `€${n.toFixed(2)}`}
        />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
        {label}
      </div>
      <div className="text-[24px] font-semibold tabular-nums tracking-tight mt-1 text-[var(--label)]">
        {value}
      </div>
    </div>
  );
}

function BarSection({
  title,
  rows,
  formatter,
}: {
  title: string;
  rows: Array<{ day: string; value: number }>;
  formatter: (n: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-3">
          {title}
        </h2>
        <p className="text-[13px] text-[var(--label-tertiary)] text-center py-4">
          Пока нет данных за этот период.
        </p>
      </section>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-3">
        {title}
      </h2>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const pct = max > 0 ? (r.value / max) * 100 : 0;
          return (
            <div key={r.day} className="flex items-center gap-3">
              <span className="w-[68px] text-[11px] text-[var(--label-tertiary)] tabular-nums shrink-0">
                {new Date(r.day).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
              <div className="flex-1 h-5 bg-[var(--fill-quaternary)] rounded-[4px] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-[4px]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-[60px] text-[12px] text-[var(--label)] font-semibold tabular-nums text-right shrink-0">
                {formatter(r.value)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
