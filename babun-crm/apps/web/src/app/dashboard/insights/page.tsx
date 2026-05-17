"use client";

// §4.2 — /dashboard/insights widgets page.
// At-a-glance summary: KPI tiles + top-3 leaderboards by period.
// Complements /finances (finance-deep) and /dashboard (calendar).

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useClients,
  useTeams,
  useServices,
} from "@/components/layout/DashboardClientLayout";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

// ─── Period helpers ──────────────────────────────────────────────────────────

type PeriodKey = "today" | "week" | "month" | "year";

interface PeriodRange {
  fromKey: string;
  toKey: string;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodRange(period: PeriodKey): PeriodRange {
  const now = new Date();
  const toKey = toDateKey(now);

  if (period === "today") {
    return { fromKey: toKey, toKey };
  }

  if (period === "week") {
    // Monday of current week (ISO)
    const d = new Date(now);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return { fromKey: toDateKey(d), toKey };
  }

  if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromKey: toDateKey(d), toKey };
  }

  // year
  const d = new Date(now.getFullYear(), 0, 1);
  return { fromKey: toDateKey(d), toKey };
}

function prevPeriodRange(period: PeriodKey): PeriodRange {
  const now = new Date();

  if (period === "today") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const key = toDateKey(d);
    return { fromKey: key, toKey: key };
  }

  if (period === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const thisMon = new Date(d);
    const prevMon = new Date(thisMon);
    prevMon.setDate(thisMon.getDate() - 7);
    const prevSun = new Date(thisMon);
    prevSun.setDate(thisMon.getDate() - 1);
    return { fromKey: toDateKey(prevMon), toKey: toDateKey(prevSun) };
  }

  if (period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { fromKey: toDateKey(first), toKey: toDateKey(last) };
  }

  // year
  const first = new Date(now.getFullYear() - 1, 0, 1);
  const last = new Date(now.getFullYear() - 1, 11, 31);
  return { fromKey: toDateKey(first), toKey: toDateKey(last) };
}

// Filter work appointments (no personal / event) within a date range
function filterWork(apts: Appointment[], range: PeriodRange): Appointment[] {
  return apts.filter(
    (a) =>
      (a.kind === undefined || a.kind === "work") &&
      a.date >= range.fromKey &&
      a.date <= range.toKey
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  delta: number | null; // percentage, null = N/A
  tone: "blue" | "green" | "mint";
}

function KpiTile({ label, value, delta, tone }: KpiTileProps) {
  const toneClass: Record<typeof tone, string> = {
    blue: "text-[var(--tile-blue,#3b82f6)]",
    green: "text-[var(--tile-green,#22c55e)]",
    mint: "text-[var(--accent)]",
  };

  const deltaEl =
    delta === null ? null : delta > 0 ? (
      <span className="flex items-center gap-0.5 text-[var(--tile-green,#22c55e)] text-[12px] font-medium">
        <TrendingUp size={12} strokeWidth={2} />
        {Math.abs(Math.round(delta))}%
      </span>
    ) : delta < 0 ? (
      <span className="flex items-center gap-0.5 text-[var(--system-red,#ef4444)] text-[12px] font-medium">
        <TrendingDown size={12} strokeWidth={2} />
        {Math.abs(Math.round(delta))}%
      </span>
    ) : (
      <span className="flex items-center gap-0.5 text-[var(--label-tertiary)] text-[12px] font-medium">
        <Minus size={12} strokeWidth={2} />0%
      </span>
    );

  return (
    <div className="flex-1 min-w-0 bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] px-3 py-3">
      <div
        className={`text-[18px] font-bold tabular-nums truncate ${toneClass[tone]}`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--label-secondary)] leading-tight mt-0.5 truncate">
        {label}
      </div>
      {deltaEl && <div className="mt-1.5">{deltaEl}</div>}
    </div>
  );
}

// ─── Leaderboard bar row ──────────────────────────────────────────────────────

interface BarRowProps {
  rank: number;
  name: string;
  value: string;
  widthPct: number; // 0–100
}

function BarRow({ rank, name, value, widthPct }: BarRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-semibold text-[var(--label-tertiary)] w-[14px] shrink-0">
            {rank}
          </span>
          <span className="text-[14px] font-medium text-[var(--label)] truncate">
            {name}
          </span>
        </div>
        <span className="text-[13px] font-semibold text-[var(--label)] tabular-nums shrink-0">
          {value}
        </span>
      </div>
      <div className="h-[4px] rounded-full bg-[var(--fill-tertiary)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.max(widthPct, 4)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Leaderboard card ─────────────────────────────────────────────────────────

interface LeaderItem {
  id: string;
  name: string;
  value: number;
  valueLabel: string;
}

interface LeaderCardProps {
  title: string;
  items: LeaderItem[];
}

function LeaderCard({ title, items }: LeaderCardProps) {
  const maxVal = items[0]?.value ?? 0;

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] px-4 py-4">
      <div className="text-[13px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-3">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-[13px] text-[var(--label-tertiary)] py-2">
          За выбранный период данных нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <BarRow
              key={item.id}
              rank={idx + 1}
              name={item.name}
              value={item.valueLabel}
              widthPct={maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [period, setPeriod] = useState<PeriodKey>("week");
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const { teams } = useTeams();
  const { services } = useServices();

  // Lookup maps derived once per render cycle
  const clientNameMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients]
  );

  const teamNameMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const serviceNameMap = useMemo(
    () => new Map(services.map((s) => [s.id, s.name])),
    [services]
  );

  // ── Current period appointments (work only) ─────────────────────────────
  const range = useMemo(() => periodRange(period), [period]);
  const prevRange = useMemo(() => prevPeriodRange(period), [period]);

  const currentApts = useMemo(
    () => filterWork(appointments, range),
    [appointments, range]
  );

  const prevApts = useMemo(
    () => filterWork(appointments, prevRange),
    [appointments, prevRange]
  );

  const completedApts = useMemo(
    () => currentApts.filter((a) => a.status === "completed"),
    [currentApts]
  );

  // ── KPI: counts ────────────────────────────────────────────────────────────
  const totalCount = currentApts.length;
  const prevCount = prevApts.length;
  const countDelta =
    prevCount === 0
      ? totalCount > 0
        ? Number.POSITIVE_INFINITY
        : null
      : ((totalCount - prevCount) / prevCount) * 100;

  // ── KPI: revenue ──────────────────────────────────────────────────────────
  const revenue = useMemo(
    () => completedApts.reduce((sum, a) => sum + (a.total_amount ?? 0), 0),
    [completedApts]
  );

  const prevRevenue = useMemo(
    () =>
      prevApts
        .filter((a) => a.status === "completed")
        .reduce((sum, a) => sum + (a.total_amount ?? 0), 0),
    [prevApts]
  );

  const revenueDelta =
    prevRevenue === 0
      ? revenue > 0
        ? Number.POSITIVE_INFINITY
        : null
      : ((revenue - prevRevenue) / prevRevenue) * 100;

  // ── KPI: completed count ──────────────────────────────────────────────────
  const completedCount = completedApts.length;
  const prevCompleted = prevApts.filter((a) => a.status === "completed").length;
  const completedDelta =
    prevCompleted === 0
      ? completedCount > 0
        ? Number.POSITIVE_INFINITY
        : null
      : ((completedCount - prevCompleted) / prevCompleted) * 100;

  // ── Top-3 teams by income ─────────────────────────────────────────────────
  const topTeams = useMemo((): LeaderItem[] => {
    const map = new Map<string, number>();
    for (const a of completedApts) {
      if (!a.team_id) continue;
      map.set(a.team_id, (map.get(a.team_id) ?? 0) + (a.total_amount ?? 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, val]) => ({
        id,
        name: teamNameMap.get(id) ?? id,
        value: val,
        valueLabel: formatEUR(val),
      }));
  }, [completedApts, teamNameMap]);

  // ── Top-3 services by frequency ──────────────────────────────────────────
  const topServices = useMemo((): LeaderItem[] => {
    const map = new Map<string, number>();
    for (const a of currentApts) {
      // Prefer structured services array; fall back to service_ids
      if (a.services && a.services.length > 0) {
        for (const s of a.services) {
          map.set(s.serviceId, (map.get(s.serviceId) ?? 0) + (s.quantity ?? 1));
        }
      } else {
        for (const sid of a.service_ids ?? []) {
          map.set(sid, (map.get(sid) ?? 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({
        id,
        name: serviceNameMap.get(id) ?? id,
        value: count,
        valueLabel: `${count} раз`,
      }));
  }, [currentApts, serviceNameMap]);

  // ── Top-3 clients by spend ────────────────────────────────────────────────
  const topClients = useMemo((): LeaderItem[] => {
    const map = new Map<string, number>();
    for (const a of completedApts) {
      if (!a.client_id) continue;
      map.set(
        a.client_id,
        (map.get(a.client_id) ?? 0) + (a.total_amount ?? 0)
      );
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, val]) => ({
        id,
        name: clientNameMap.get(id) ?? "—",
        value: val,
        valueLabel: formatEUR(val),
      }));
  }, [completedApts, clientNameMap]);

  // ── Delta display helpers ─────────────────────────────────────────────────
  function toDeltaPct(raw: number | null): number | null {
    if (raw === null) return null;
    if (!Number.isFinite(raw)) return raw > 0 ? 999 : null;
    return raw;
  }

  return (
    <>
      <PageHeader title="Сводка" showBack={false} />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

          {/* Period chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`h-9 px-4 rounded-full text-[14px] font-medium shrink-0 transition-colors ${
                  period === key
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-quaternary)] text-[var(--label)] active:bg-[var(--fill-tertiary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* KPI tiles row */}
          <div className="flex gap-2.5">
            <KpiTile
              label="Записей"
              value={String(totalCount)}
              delta={toDeltaPct(countDelta)}
              tone="blue"
            />
            <KpiTile
              label="Выручка"
              value={formatEUR(revenue)}
              delta={toDeltaPct(revenueDelta)}
              tone="green"
            />
            <KpiTile
              label="Завершено"
              value={String(completedCount)}
              delta={toDeltaPct(completedDelta)}
              tone="mint"
            />
          </div>

          {/* Leaderboards */}
          <LeaderCard title="Топ команды" items={topTeams} />
          <LeaderCard title="Топ услуги" items={topServices} />
          <LeaderCard title="Топ клиенты" items={topClients} />

        </div>
      </div>
    </>
  );
}
