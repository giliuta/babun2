"use client";

// Sprint 033 Phase I32 — Master Employment subroute.
// Owns the "как устроен" part of a master: role, brigade assignment,
// contract type, dates, and work schedule. iOS Settings grouped
// cards with instant commit on blur.

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  CONTRACT_LABELS,
  ROLE_LABELS,
  WEEKDAY_LABELS,
  defaultPermissionsForRole,
  defaultWorkSchedule,
  getTeamLeadIds,
  type ContractType,
  type Master,
  type MasterRole,
  type Team,
  type WorkSchedule,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

const ROLE_ORDER: MasterRole[] = ["admin", "dispatcher", "lead", "helper"];
const CONTRACT_ORDER: ContractType[] = [
  "full_time",
  "part_time",
  "contractor",
  "trial",
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterEmploymentPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { masters, upsertMaster } = useMasters();
  const { teams } = useTeams();
  const master = masters.find((m) => m.id === id);

  const [schedule, setSchedule] = useState<WorkSchedule>(
    master?.work_schedule ?? defaultWorkSchedule(),
  );

  useEffect(() => {
    setSchedule(master?.work_schedule ?? defaultWorkSchedule());
  }, [master]);

  // Assigned brigades = union of legacy primary (team_id) and every
  // team whose lead_ids/helper_ids contains this master. Read-only on
  // this page — membership is edited on the brigade page itself.
  const assignedBrigades = useMemo<
    { team: Team; role: "lead" | "helper" | "primary" }[]
  >(() => {
    if (!master) return [];
    const seen = new Map<string, { team: Team; role: "lead" | "helper" | "primary" }>();
    for (const t of teams) {
      const leadIds = getTeamLeadIds(t);
      if (leadIds.includes(master.id)) {
        seen.set(t.id, { team: t, role: "lead" });
      } else if (t.helper_ids.includes(master.id)) {
        seen.set(t.id, { team: t, role: "helper" });
      }
    }
    if (master.team_id) {
      const t = teams.find((x) => x.id === master.team_id);
      if (t && !seen.has(t.id)) {
        seen.set(t.id, { team: t, role: "primary" });
      }
    }
    return Array.from(seen.values());
  }, [master, teams]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Трудоустройство" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const patch = (diff: Partial<Master>) => {
    upsertMaster({ ...master, ...diff });
  };

  const commitRole = (next: MasterRole) => {
    if (next === master.role) return;
    haptic("tap");
    patch({
      role: next,
      permissions: defaultPermissionsForRole(next),
    });
  };

  const commitContract = (next: ContractType) => {
    if (next === master.contract_type) return;
    haptic("tap");
    patch({ contract_type: next });
  };

  const commitHireDate = (v: string) => {
    if (v === (master.hire_date ?? "")) return;
    patch({ hire_date: v || undefined });
  };

  const commitSchedule = (next: WorkSchedule) => {
    setSchedule(next);
    patch({ work_schedule: next });
  };

  const toggleDay = (idx: number) => {
    const days = [...schedule.days] as WorkSchedule["days"];
    days[idx] = !days[idx];
    haptic("tap");
    commitSchedule({ ...schedule, days });
  };

  const commitScheduleTime = (field: "start_time" | "end_time", v: string) => {
    if (!v) return;
    commitSchedule({ ...schedule, [field]: v });
  };

  void teams; // read via assignedBrigades

  return (
    <MasterSectionShell masterId={id} title="Трудоустройство" hideSave>
      {/* ── Роль ─────────────────────────────────────────────────── */}
      <Section title="Роль" footer="Определяет, что сотрудник может в Babun по умолчанию.">
        <div className="p-2 grid grid-cols-2 gap-2">
          {ROLE_ORDER.map((r) => {
            const picked = master.role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => commitRole(r)}
                className={`h-10 rounded-[10px] text-[14px] font-medium press-scale transition-colors ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Бригады (read-only) ─────────────────────────────────── */}
      <Section
        title="Бригады"
        footer="Сотрудник привязывается к бригаде на странице самой бригады. Тут — только список, куда его уже добавили."
      >
        {assignedBrigades.length === 0 ? (
          <div className="px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
            Пока не в одной бригаде.
            <br />
            Откройте нужную бригаду и добавьте его в составе.
          </div>
        ) : (
          assignedBrigades.map(({ team: t, role: assignRole }, i) => {
            const last = i === assignedBrigades.length - 1;
            const roleLabel =
              assignRole === "lead"
                ? "Бригадир"
                : assignRole === "helper"
                  ? "Помощник"
                  : "Основная";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  haptic("tap");
                  router.push(`/dashboard/teams/${t.id}`);
                }}
                className={`w-full flex items-center gap-3 px-4 min-h-[48px] ${
                  last ? "" : "border-b border-[var(--separator)]"
                } active:bg-[var(--fill-quaternary)] transition-colors`}
              >
                <span
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] text-[var(--label)] truncate">
                    {t.name}
                  </span>
                  <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
                    {roleLabel}
                    {t.default_city ? ` · ${t.default_city}` : ""}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="text-[var(--label-quaternary)] shrink-0"
                />
              </button>
            );
          })
        )}
      </Section>

      {/* ── Контракт ─────────────────────────────────────────────── */}
      <Section title="Тип занятости">
        <div className="p-2 grid grid-cols-2 gap-2">
          {CONTRACT_ORDER.map((c) => {
            const picked = master.contract_type === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => commitContract(c)}
                className={`h-10 px-2 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                }`}
              >
                {CONTRACT_LABELS[c]}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Дата найма ───────────────────────────────────────────── */}
      <Section title="Дата найма">
        <label className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Дата
          </span>
          <input
            type="date"
            value={master.hire_date ?? ""}
            onChange={(e) => commitHireDate(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
      </Section>

      {/* ── График ───────────────────────────────────────────────── */}
      <Section
        title="Рабочий график"
        footer="Используется для подсказок в календаре и расчёта почасовой ЗП."
      >
        <div className="px-4 py-3 border-b border-[var(--separator)]">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const on = schedule.days[i];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-10 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                    on
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-3 min-h-[44px] px-4 border-b border-[var(--separator)]">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Начало дня
          </span>
          <input
            type="time"
            value={schedule.start_time}
            onChange={(e) => commitScheduleTime("start_time", e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Конец дня
          </span>
          <input
            type="time"
            value={schedule.end_time}
            onChange={(e) => commitScheduleTime("end_time", e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
      </Section>
    </MasterSectionShell>
  );
}

function Section({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}
