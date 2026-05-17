"use client";

// Sprint 033 Phase I32 — Master Access (permissions) subroute.
// Account creds moved to /info; this page owns only the permissions
// matrix plus brigade visibility. iOS Settings grouped cards.
//
// v533 — added preset chips (Менеджер / Мастер / Диспетчер /
// Только просмотр / Кастомные), collapsible groups with persisted
// expand-state, and a search field that auto-expands all groups
// while filtering by label.

import { use, useEffect, useMemo, useState } from "react";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/components/layout/DashboardClientLayout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  defaultPermissionsForRole,
  mergePermissions,
  type MasterPermissions,
  type PermissionGroupKey,
} from "@babun/shared/local/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";
import {
  GROUPS_OPEN_KEY,
  PRESETS,
  type GroupsOpenState,
  type PresetId,
  defaultGroupsOpen,
  detectPreset,
  loadGroupsOpen,
  normalizeLabel,
  permissionsEqual,
} from "./presets";

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

  // BUGFIX (bug-hunt sweep) — `currentVisibility` was below the
  // `if (!master) early-return` which violated rules-of-hooks. Keep
  // all hooks above any conditional return.
  const currentVisibility: VisibilityMode = useMemo(() => {
    const v = permissions.visible_team_ids ?? [];
    if (v.includes("*")) return "all";
    if (v.length === 0) return "own";
    return "picked";
  }, [permissions.visible_team_ids]);

  const activePreset: PresetId = useMemo(
    () => detectPreset(permissions),
    [permissions],
  );

  const [groupsOpen, setGroupsOpen] = useState<GroupsOpenState>(() =>
    defaultGroupsOpen(),
  );
  const [groupsHydrated, setGroupsHydrated] = useState(false);
  const [query, setQuery] = useState("");

  // Hydrate expand-state from localStorage after mount to keep SSR
  // happy. React-Compiler flags both setState calls as cascading
  // renders, but this is the canonical client-only hydration pattern
  // — first paint matches SSR (defaults), then this effect upgrades
  // to the persisted state in one synchronous batch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroupsOpen(loadGroupsOpen());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroupsHydrated(true);
  }, []);

  useEffect(() => {
    if (!groupsHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(GROUPS_OPEN_KEY, JSON.stringify(groupsOpen));
    } catch {
      // ignore
    }
  }, [groupsOpen, groupsHydrated]);

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

  const applyPreset = (preset: Exclude<PresetId, "custom">) => {
    const built = PRESETS.find((p) => p.id === preset);
    if (!built) return;
    if (permissionsEqual(permissions, built.build())) return;
    haptic("tap");
    upsertMaster({
      ...master,
      permissions: built.build(),
    });
  };

  const togglePermission = (key: keyof MasterPermissions) => {
    if (key === "visible_team_ids") return;
    haptic("tap");
    commit({ [key]: !permissions[key] } as Partial<MasterPermissions>);
  };

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

  const toggleGroup = (key: PermissionGroupKey) => {
    haptic("tap");
    setGroupsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeTeams = teams.filter((t) => t.active !== false);

  const normalizedQuery = normalizeLabel(query.trim());
  const searchActive = normalizedQuery.length > 0;

  // Filtered permissions per group (only matters when search is active).
  const filteredGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: searchActive
      ? group.permissions.filter((p) =>
          normalizeLabel(PERMISSION_LABELS[p]).includes(normalizedQuery),
        )
      : group.permissions,
  })).filter((g) => g.permissions.length > 0);

  return (
    <MasterSectionShell masterId={id} title="Доступы" hideSave>
      {/* ── Пресеты ──────────────────────────────────────────────── */}
      <Section
        title="Шаблоны прав"
        footer="Быстрый набор: один тап вместо тридцати тумблеров."
      >
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {PRESETS.map((p) => {
            const picked = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`access-preset-${p.id}`}
                onClick={() => applyPreset(p.id)}
                title={p.description}
                aria-pressed={picked}
                className={`h-9 px-3.5 rounded-full text-[13px] font-medium press-scale transition-colors ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)] shadow-sm"
                    : "bg-[var(--fill-quaternary)] text-[var(--label)] active:bg-[var(--fill-tertiary)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {activePreset === "custom" && (
            <span
              data-testid="access-preset-custom"
              className="h-9 px-3.5 rounded-full text-[13px] font-medium bg-[var(--accent-tint)] text-[var(--accent)] inline-flex items-center"
              aria-pressed
            >
              Кастомные
            </span>
          )}
        </div>
      </Section>

      {/* ── Видимость команд ────────────────────────────────────── */}
      <Section
        title="Видимость команд"
        footer="Что сотрудник увидит в календаре, когда войдёт в Babun."
      >
        {(
          [
            { v: "own", label: "Только своя команда" },
            { v: "picked", label: "Выбранные команды" },
            { v: "all", label: "Все команды" },
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
        <Section title="Какие команды видит">
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
              Нет активных команд.
            </div>
          )}
        </Section>
      )}

      {/* ── Поиск по правам ─────────────────────────────────────── */}
      <div className="px-4">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="access-search"
          placeholder="Найти право…"
          aria-label="Поиск по правам доступа"
          className="w-full h-10 px-3 rounded-[var(--radius-input)] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* ── Права по группам (collapsible) ──────────────────────── */}
      {filteredGroups.map((group) => {
        const expanded = searchActive ? true : groupsOpen[group.key];
        const panelId = `access-group-${group.key}-panel`;
        return (
          <div key={group.key}>
            <button
              type="button"
              data-testid={`access-group-${group.key}`}
              onClick={() => !searchActive && toggleGroup(group.key)}
              aria-expanded={expanded}
              aria-controls={panelId}
              disabled={searchActive}
              className="w-full flex items-center justify-between gap-3 px-4 pb-1.5 text-left disabled:cursor-default"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
                {group.title}
              </span>
              {!searchActive && (
                <span
                  className={`text-[12px] text-[var(--label-tertiary)] transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ›
                </span>
              )}
            </button>
            <div
              id={panelId}
              hidden={!expanded}
              className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden"
            >
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
            </div>
            {expanded && group.description && (
              <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
                {group.description}
              </div>
            )}
          </div>
        );
      })}

      {searchActive && filteredGroups.length === 0 && (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          По запросу «{query}» прав не найдено.
        </div>
      )}

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
