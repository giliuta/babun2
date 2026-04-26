"use client";

// Sprint 034 — master stats drill-down (v307).
//
// Opens from the hub's «За этот месяц» card and from the Статистика
// NavRow. Shows period-over-period numbers computed on the fly from
// the shared appointments context:
//   · визиты / закрыто / отменено / средний чек / выручка
//   · сравнение с медианой бригады за тот же период
//   · топ-5 клиентов по выручке
//
// Period toggle: Неделя · Месяц · Квартал · Год. Defaults to Month.

import { use, useMemo, useState } from "react";
import {
  useAppointments,
  useMasters,
  useTeams,
} from "@/app/dashboard/layout";
import { getTeamLeadIds, type Team } from "@babun/shared/local/masters";
import { useClients } from "@/app/dashboard/layout";
import type { Appointment } from "@babun/shared/local/appointments";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

type Period = "week" | "month" | "quarter" | "year" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Неделя",
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
  custom: "Свой",
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDate(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const out = new Date(y, m - 1, d);
  out.setHours(0, 0, 0, 0);
  return out;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterStatsPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters } = useMasters();
  const { teams } = useTeams();
  const { appointments } = useAppointments();
  const { clients } = useClients();

  const [period, setPeriod] = useState<Period>("month");
  // Custom range — defaults to «начало месяца → сегодня».
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customTo, setCustomTo] = useState(() => todayKey());

  const master = masters.find((m) => m.id === id);

  const assignedTeams = useMemo<Team[]>(() => {
    if (!master) return [];
    const seen = new Map<string, Team>();
    if (master.team_id) {
      const t = teams.find((x) => x.id === master.team_id);
      if (t) seen.set(t.id, t);
    }
    for (const t of teams) {
      const leadIds = getTeamLeadIds(t);
      if (leadIds.includes(master.id) || t.helper_ids.includes(master.id)) {
        if (!seen.has(t.id)) seen.set(t.id, t);
      }
    }
    return Array.from(seen.values());
  }, [master, teams]);

  const teamIds = useMemo(
    () => new Set(assignedTeams.map((t) => t.id)),
    [assignedTeams],
  );

  // Filter appointments by period window. Custom range uses the
  // explicit from/to inputs; presets compute relative to today.
  const { start, end } = useMemo(
    () => periodWindow(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const myApts = useMemo(() => {
    if (!master) return [] as Appointment[];
    return appointments.filter((a) => {
      if (a.master_id !== master.id) return false;
      if (a.team_id && !teamIds.has(a.team_id)) return false;
      const d = new Date(a.date);
      return d >= start && d < end;
    });
  }, [appointments, master, teamIds, start, end]);

  const teamApts = useMemo(() => {
    return appointments.filter((a) => {
      if (!a.team_id || !teamIds.has(a.team_id)) return false;
      const d = new Date(a.date);
      return d >= start && d < end;
    });
  }, [appointments, teamIds, start, end]);

  const stats = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let revenue = 0;
    for (const a of myApts) {
      if (a.status === "completed") {
        completed += 1;
        revenue += a.total_amount ?? 0;
      } else if (a.status === "cancelled") {
        cancelled += 1;
      }
    }
    const total = myApts.length;
    const avgCheck = completed > 0 ? Math.round(revenue / completed) : 0;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, cancelled, revenue, avgCheck, completionRate };
  }, [myApts]);

  // Team comparison: what does an average team member look like in
  // the same period? Revenue ÷ distinct master_id with at least one
  // completed visit.
  const teamBenchmark = useMemo(() => {
    const revenueByMaster = new Map<string, number>();
    for (const a of teamApts) {
      if (a.status !== "completed" || !a.master_id) continue;
      revenueByMaster.set(
        a.master_id,
        (revenueByMaster.get(a.master_id) ?? 0) + (a.total_amount ?? 0),
      );
    }
    const peers = Array.from(revenueByMaster.values());
    if (peers.length === 0) return null;
    const sorted = peers.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const rank = sorted.filter((v) => v < stats.revenue).length + 1;
    return {
      median,
      rank,
      total: sorted.length,
      vsMedianPct:
        median > 0 ? Math.round((stats.revenue / median) * 100) : null,
    };
  }, [teamApts, stats.revenue]);

  // Top 5 clients by revenue for this master in the period.
  const topClients = useMemo(() => {
    const byClient = new Map<string, number>();
    for (const a of myApts) {
      if (a.status !== "completed" || !a.client_id) continue;
      byClient.set(
        a.client_id,
        (byClient.get(a.client_id) ?? 0) + (a.total_amount ?? 0),
      );
    }
    return Array.from(byClient.entries())
      .map(([cid, total]) => {
        const c = clients.find((x) => x.id === cid);
        return { id: cid, name: c?.full_name ?? "Клиент", total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [myApts, clients]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Статистика" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  return (
    <MasterSectionShell masterId={id} title="Статистика" hideSave>
      {/* Period switch — 5 chips. «Свой» reveals from/to inputs. */}
      <div>
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-9 rounded-[10px] text-[12px] font-semibold press-scale transition-colors ${
                period === p
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="mt-2 bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <DateRangeRow
              label="С"
              value={customFrom}
              onChange={setCustomFrom}
              max={customTo}
            />
            <DateRangeRow
              label="По"
              value={customTo}
              onChange={setCustomTo}
              min={customFrom}
              last
            />
          </div>
        )}
      </div>

      {/* Big revenue card */}
      <div className="bg-gradient-to-br from-[var(--accent-tint)] to-[var(--surface-card)] border border-[var(--accent-tint)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Выручка
        </div>
        <div className="text-[34px] font-bold text-[var(--label)] tabular-nums leading-none mt-1">
          {Math.round(stats.revenue).toLocaleString("ru-RU")} €
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] mt-2">
          средний чек ·{" "}
          <span className="tabular-nums font-semibold">
            {stats.avgCheck.toLocaleString("ru-RU")} €
          </span>
        </div>
      </div>

      {/* Numbers grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Всего визитов" value={String(stats.total)} />
        <StatBox label="Закрыто" value={String(stats.completed)} />
        <StatBox label="Отменено" value={String(stats.cancelled)} />
        <StatBox
          label="Закрытие"
          value={`${stats.completionRate}%`}
          warning={stats.completionRate < 70 && stats.total > 0}
        />
      </div>

      {/* Team comparison */}
      {teamBenchmark && (
        <Card title="Сравнение с бригадой">
          <div className="space-y-2">
            <ComparisonRow
              label="Место в бригаде"
              value={`${teamBenchmark.rank} из ${teamBenchmark.total}`}
            />
            <ComparisonRow
              label="Медианная выручка коллег"
              value={`${Math.round(teamBenchmark.median).toLocaleString("ru-RU")} €`}
            />
            {teamBenchmark.vsMedianPct !== null && (
              <ComparisonRow
                label="Относительно медианы"
                value={`${teamBenchmark.vsMedianPct}%`}
                emphasise={
                  teamBenchmark.vsMedianPct >= 100 ? "good" : "bad"
                }
              />
            )}
          </div>
        </Card>
      )}

      {/* Top clients */}
      {topClients.length > 0 && (
        <Card
          title={`Топ клиентов · ${periodCaption(period, customFrom, customTo)}`}
        >
          <div className="divide-y divide-[var(--separator)] -mx-4">
            {topClients.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center text-[11px] font-bold text-[var(--label-secondary)] tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 text-[14px] text-[var(--label)] truncate">
                  {c.name}
                </span>
                <span className="text-[13px] font-semibold text-[var(--label)] tabular-nums">
                  {Math.round(c.total).toLocaleString("ru-RU")} €
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stats.total === 0 && (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          {periodCaption(period, customFrom, customTo)} — визитов нет.
        </div>
      )}
    </MasterSectionShell>
  );
}

// ─── Period math ────────────────────────────────────────────────────

function periodWindow(
  period: Period,
  customFrom: string,
  customTo: string,
): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  switch (period) {
    case "week":
      start.setDate(now.getDate() - 6);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom": {
      const from = isoToDate(customFrom);
      const to = isoToDate(customTo);
      if (from) start = from;
      if (to) {
        // Make end exclusive — include the «to» day fully.
        end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
      }
      // If user inverted from > to, swap silently rather than show empty.
      if (start > end) {
        const tmp = start;
        start = new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate() - 1,
        );
        end = new Date(
          tmp.getFullYear(),
          tmp.getMonth(),
          tmp.getDate() + 1,
        );
      }
      break;
    }
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function periodCaption(
  period: Period,
  customFrom?: string,
  customTo?: string,
): string {
  if (period !== "custom") {
    return `за ${PERIOD_LABELS[period].toLowerCase()}`;
  }
  if (!customFrom || !customTo) return "за выбранный период";
  return `${formatDateShort(customFrom)} — ${formatDateShort(customTo)}`;
}

function formatDateShort(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

// ─── Layout primitives ──────────────────────────────────────────────

function DateRangeRow({
  label,
  value,
  onChange,
  min,
  max,
  last,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[14px] text-[var(--label)] w-[36px] shrink-0">
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-[14px] text-[var(--label)] text-right focus:outline-none tabular-nums"
      />
    </label>
  );
}

function StatBox({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
      <div
        className={`text-[22px] font-bold tabular-nums leading-none ${
          warning ? "text-[var(--system-orange)]" : "text-[var(--label)]"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--label-tertiary)] uppercase tracking-wide mt-1.5">
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: string;
  emphasise?: "good" | "bad";
}) {
  return (
    <div className="flex items-center justify-between text-[14px]">
      <span className="text-[var(--label-secondary)]">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          emphasise === "good"
            ? "text-[var(--system-green)]"
            : emphasise === "bad"
              ? "text-[var(--system-orange)]"
              : "text-[var(--label)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
