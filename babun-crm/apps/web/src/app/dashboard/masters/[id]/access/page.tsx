"use client";

// Sprint 033 Phase I32 — Master Access (permissions) subroute.
// Account creds moved to /info; this page owns only the permissions
// matrix plus brigade visibility. iOS Settings grouped cards.

import { use, useMemo } from "react";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/components/layout/DashboardClientLayout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  defaultPermissionsForRole,
  mergePermissions,
  type MasterPermissions,
} from "@babun/shared/local/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

type VisibilityMode = "own" | "picked" | "all";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterAccessPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters, upsertMaster } = useMasters();
  const { teams } = useTeams();
  const master = masters.find((m) => m.id === id);

  const permissions: MasterPermissions = useMemo(
    () =>
      master
        ? mergePermissions(master.role, master.permissions)
        : defaultPermissionsForRole("helper"),
    [master],
  );

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Доступы" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const commit = (diff: Partial<MasterPermissions>) => {
    upsertMaster({
      ...master,
      permissions: { ...permissions, ...diff },
    });
  };

  const togglePermission = (key: keyof MasterPermissions) => {
    if (key === "visible_team_ids") return;
    haptic("tap");
    commit({ [key]: !permissions[key] } as Partial<MasterPermissions>);
  };

  const currentVisibility: VisibilityMode = useMemo(() => {
    const v = permissions.visible_team_ids ?? [];
    if (v.includes("*")) return "all";
    if (v.length === 0) return "own";
    return "picked";
  }, [permissions.visible_team_ids]);

  const setVisibility = (next: VisibilityMode) => {
    if (next === currentVisibility) return;
    haptic("tap");
    if (next === "own") commit({ visible_team_ids: [] });
    else if (next === "all") commit({ visible_team_ids: ["*"] });
    else {
      // "picked" — seed with the master's own team if any, else first active team
      const seed = master.team_id ? [master.team_id] : [];
      commit({ visible_team_ids: seed });
    }
  };

  const toggleVisibleTeam = (teamId: string) => {
    const arr = permissions.visible_team_ids ?? [];
    const next = arr.includes(teamId)
      ? arr.filter((t) => t !== teamId)
      : [...arr, teamId];
    haptic("tap");
    commit({ visible_team_ids: next });
  };

  const resetToDefaults = () => {
    haptic("warning");
    upsertMaster({
      ...master,
      permissions: defaultPermissionsForRole(master.role),
    });
  };

  const activeTeams = teams.filter((t) => t.active !== false);

  return (
    <MasterSectionShell masterId={id} title="Доступы" hideSave>
      {/* ── Видимость бригад ────────────────────────────────────── */}
      <Section
        title="Видимость бригад"
        footer="Что сотрудник увидит в календаре, когда войдёт в Babun."
      >
        {(
          [
            { v: "own", label: "Только своя бригада" },
            { v: "picked", label: "Выбранные бригады" },
            { v: "all", label: "Все бригады" },
          ] as const
        ).map((opt, i, arr) => {
          const picked = currentVisibility === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => setVisibility(opt.v)}
              className={`w-full flex items-center justify-between gap-3 px-4 min-h-[48px] ${
                i === arr.length - 1 ? "" : "border-b border-[var(--separator)]"
              } transition-colors ${
                picked ? "bg-[var(--accent-tint)]" : "active:bg-[var(--fill-quaternary)]"
              }`}
            >
              <span
                className={`text-[15px] text-left ${
                  picked ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"
                }`}
              >
                {opt.label}
              </span>
              {picked && (
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--label-on-accent)] text-[11px] font-bold shrink-0">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </Section>

      {currentVisibility === "picked" && (
        <Section title="Какие бригады видит">
          {activeTeams.map((t, i) => {
            const picked = (permissions.visible_team_ids ?? []).includes(t.id);
            const last = i === activeTeams.length - 1;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 px-4 min-h-[48px] ${
                  last ? "" : "border-b border-[var(--separator)]"
                }`}
              >
                <span
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-[15px] text-[var(--label)] flex-1 truncate">
                  {t.name}
                </span>
                <IOSSwitch
                  checked={picked}
                  onChange={() => toggleVisibleTeam(t.id)}
                  ariaLabel={t.name}
                />
              </div>
            );
          })}
          {activeTeams.length === 0 && (
            <div className="px-4 py-4 text-center text-[13px] text-[var(--label-tertiary)]">
              Нет активных бригад.
            </div>
          )}
        </Section>
      )}

      {/* ── Права по группам ─────────────────────────────────────── */}
      {PERMISSION_GROUPS.map((group) => (
        <Section key={group.key} title={group.title} footer={group.description}>
          {group.permissions.map((p, i) => {
            const last = i === group.permissions.length - 1;
            return (
              <div
                key={p}
                className={`flex items-center gap-3 px-4 min-h-[48px] ${
                  last ? "" : "border-b border-[var(--separator)]"
                }`}
              >
                <span className="text-[15px] text-[var(--label)] flex-1 leading-snug">
                  {PERMISSION_LABELS[p]}
                </span>
                <IOSSwitch
                  checked={Boolean(permissions[p as keyof MasterPermissions])}
                  onChange={() =>
                    togglePermission(p as keyof MasterPermissions)
                  }
                  ariaLabel={PERMISSION_LABELS[p]}
                />
              </div>
            );
          })}
        </Section>
      ))}

      {/* ── Сброс ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={resetToDefaults}
        className="w-full h-12 flex items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--accent)] text-[14px] font-medium press-scale active:bg-[var(--fill-quaternary)] shadow-[var(--shadow-card)]"
      >
        Сбросить на стандартные для роли
      </button>
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
