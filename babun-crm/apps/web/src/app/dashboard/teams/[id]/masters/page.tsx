"use client";

// Sprint 033 Phase I44 — Brigade masters, clean-slate roles + role
// editing + searchable master picker.
//
// Changes from I43:
//  · Removed the auto-seed of «Старший» + «Помощник». Fresh brigades
//    open with an empty role list and empty member list — tenant
//    authors both. Legacy brigades (lead_ids / helper_ids already
//    populated) still migrate, but only with one role per bucket
//    that actually has members.
//  · Role group header shows an edit pencil and long-press opens
//    «Редактировать» + «Удалить». RoleEditor modal covers rename +
//    colour. Deleting a role with members re-parents them to
//    «Без роли» (role_id = null).
//  · AddMemberPicker gains a search input over the master list so
//    100+ masters scroll cleanly.

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import { useMasters, useTeams } from "@/components/layout/DashboardClientLayout";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";
import {
  LEGACY_HELPER_ROLE_ID,
  LEGACY_LEAD_ROLE_ID,
  generateId,
  getInitials,
  type BrigadeMember,
  type BrigadeRole,
  type Master,
  type Team,
} from "@babun/shared/local/masters";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function BrigadeMastersPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { teams, upsertTeam } = useTeams();
  const { masters } = useMasters();
  const confirm = useConfirm();
  const team = teams.find((t) => t.id === id);

  // ── State ──────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BrigadeMember | null>(
    null,
  );
  // Phase I47 — tap on member navigates to /[masterId] access editor.
  // null = not editing; { id: null } = creating a new role
  const [editingRole, setEditingRole] = useState<BrigadeRole | { id: null } | null>(
    null,
  );
  const [roleMenu, setRoleMenu] = useState<{
    role: BrigadeRole;
    anchor: { x: number; y: number };
  } | null>(null);

  // ── Lazy migration from legacy lead/helper arrays ──────────────
  useEffect(() => {
    if (!team) return;
    if (team.members) return; // already on the new shape
    const legacyLeadIds = team.lead_ids?.length
      ? team.lead_ids.filter(Boolean)
      : team.lead_id
        ? [team.lead_id]
        : [];
    const legacyHelperIds = team.helper_ids ?? [];
    if (legacyLeadIds.length === 0 && legacyHelperIds.length === 0) {
      // Nothing to migrate, start clean — empty roles + empty members.
      upsertTeam({ ...team, roles: [], members: [] });
      return;
    }
    // Only seed roles for buckets that actually have people.
    const migratedRoles: BrigadeRole[] = [];
    if (legacyLeadIds.length > 0) {
      migratedRoles.push({
        id: LEGACY_LEAD_ROLE_ID,
        name: "Старший",
        color: "#FFCC00",
      });
    }
    if (legacyHelperIds.length > 0) {
      migratedRoles.push({
        id: LEGACY_HELPER_ROLE_ID,
        name: "Помощник",
        color: "#8E8E93",
      });
    }
    const members: BrigadeMember[] = [
      ...legacyLeadIds.map((mid) => ({
        master_id: mid,
        role_id: LEGACY_LEAD_ROLE_ID,
      })),
      ...legacyHelperIds
        .filter((mid) => !legacyLeadIds.includes(mid))
        .map((mid) => ({ master_id: mid, role_id: LEGACY_HELPER_ROLE_ID })),
    ];
    upsertTeam({
      ...team,
      roles: [...(team.roles ?? []), ...migratedRoles],
      members,
    });
  }, [team, upsertTeam]);

  // BUGFIX (bug-hunt sweep) — `roles`/`members` and the `grouped`
  // useMemo were below the `if (!team) early-return`, making the
  // useMemo conditional. Hoisted with fallback to empty arrays so
  // the hook runs unconditionally; the early return now sits below
  // these declarations.
  const roles: BrigadeRole[] = team?.roles ?? [];
  const members: BrigadeMember[] = team?.members ?? [];

  // ── Derived groups (hoisted from line 260 below to satisfy
  //    rules-of-hooks). Empty when team is undefined. ──────────
  const grouped = useMemo(() => {
    const byRole = new Map<string | null, Master[]>();
    byRole.set(null, []);
    for (const r of roles) byRole.set(r.id, []);
    for (const m of members) {
      const master = masters.find((mm) => mm.id === m.master_id);
      if (!master) continue;
      const key =
        m.role_id && roles.some((r) => r.id === m.role_id) ? m.role_id : null;
      const arr = byRole.get(key) ?? [];
      arr.push(master);
      byRole.set(key, arr);
    }
    return byRole;
  }, [members, roles, masters]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Команда" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Команда не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // ── Legacy sync (keep lead_ids/helper_ids aligned) ────────────
  const toLegacy = (rolesNow: BrigadeRole[], membersNow: BrigadeMember[]) => {
    const leadRoleIds = new Set(
      rolesNow
        .filter((r) => r.name.trim().toLowerCase() === "бригадир")
        .map((r) => r.id),
    );
    const leadIds: string[] = [];
    const helperIds: string[] = [];
    for (const m of membersNow) {
      if (m.role_id && leadRoleIds.has(m.role_id)) leadIds.push(m.master_id);
      else helperIds.push(m.master_id);
    }
    return {
      lead_id: leadIds[0] ?? null,
      lead_ids: leadIds,
      helper_ids: helperIds,
    };
  };

  const persist = (
    nextRoles: BrigadeRole[],
    nextMembers: BrigadeMember[],
  ) => {
    const legacy = toLegacy(nextRoles, nextMembers);
    upsertTeam({
      ...team,
      roles: nextRoles,
      members: nextMembers,
      ...legacy,
    });
  };

  // ── Member actions ──────────────────────────────────────────
  // Role id is required now — picker disables Add when no role chosen.
  const addMember = (masterId: string, roleId: string) => {
    if (members.some((m) => m.master_id === masterId)) return;
    haptic("tap");
    persist(roles, [...members, { master_id: masterId, role_id: roleId }]);
    setPickerOpen(false);
  };

  const setMemberRole = (masterId: string, roleId: string | null) => {
    haptic("tap");
    persist(
      roles,
      members.map((m) =>
        m.master_id === masterId ? { ...m, role_id: roleId } : m,
      ),
    );
    setEditingMember(null);
  };

  const removeMember = async (masterId: string) => {
    const master = masters.find((m) => m.id === masterId);
    const ok = await confirm({
      title: `Убрать ${master?.full_name ?? "мастера"} из команды?`,
      message:
        "Мастер останется в разделе Мастера, но больше не будет в этой команде.",
      confirmLabel: "Убрать",
    });
    if (!ok) return;
    haptic("warning");
    persist(
      roles,
      members.filter((m) => m.master_id !== masterId),
    );
  };

  // ── Role actions ────────────────────────────────────────────
  const createRole = (name: string, color: string): BrigadeRole => {
    const trimmed = name.trim();
    const existing = roles.find(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const next: BrigadeRole = { id: generateId("role"), name: trimmed, color };
    persist([...roles, next], members);
    return next;
  };

  const updateRole = (
    roleId: string,
    nextName: string,
    nextColor: string,
  ) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    haptic("tap");
    persist(
      roles.map((r) =>
        r.id === roleId ? { ...r, name: trimmed, color: nextColor } : r,
      ),
      members,
    );
    setEditingRole(null);
  };

  const deleteRole = async (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    const count = members.filter((m) => m.role_id === roleId).length;
    const msg =
      count > 0
        ? `${count} ${count === 1 ? "мастер перейдёт" : "мастера перейдут"} в раздел «Без роли». Мастера в команде останутся.`
        : "Роль пустая — можно удалить.";
    const ok = await confirm({
      title: `Удалить роль «${role?.name ?? ""}»?`,
      message: msg,
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    persist(
      roles.filter((r) => r.id !== roleId),
      members.map((m) => (m.role_id === roleId ? { ...m, role_id: null } : m)),
    );
  };

  // (`grouped` useMemo hoisted above the early return — see bug-hunt
  // bugfix comment.)

  const availableMasters = masters.filter(
    (m) => m.is_active && !members.some((mm) => mm.master_id === m.id),
  );

  const roleMenuOptions: ContextMenuOption[] = roleMenu
    ? [
        {
          label: "Редактировать",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => setEditingRole(roleMenu.role),
        },
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => deleteRole(roleMenu.role.id),
        },
      ]
    : [];

  return (
    <BrigadeSectionShell brigadeId={id} title="Сотрудники" hideSave>
      {/* ── Empty-state ─────────────────────────────────────── */}
      {members.length === 0 && roles.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-6 py-8 text-center">
          <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center mx-auto mb-3">
            <Users size={28} strokeWidth={2} />
          </span>
          <div className="text-[17px] font-semibold text-[var(--label)]">
            Пусто
          </div>
          <div className="mt-1 text-[13px] text-[var(--label-secondary)] leading-snug">
            Добавьте первого мастера и назначьте ему роль —
            например «Установщик» или «Электрик». Или создайте
            роль заранее через «+ Новая роль» в окне добавления.
          </div>
        </div>
      ) : (
        <>
          {/* Groups with members */}
          {roles.map((role) => {
            const people = grouped.get(role.id) ?? [];
            return (
              <RoleGroup
                key={role.id}
                role={role}
                people={people}
                team={team}
                onTapMember={(master) =>
                  router.push(
                    `/dashboard/teams/${team.id}/masters/${master.id}`,
                  )
                }
                onEditRole={() => setEditingRole(role)}
                onLongPressRole={(anchor) => setRoleMenu({ role, anchor })}
              />
            );
          })}
          {/* Unassigned bucket */}
          {(grouped.get(null)?.length ?? 0) > 0 && (
            <RoleGroup
              role={null}
              people={grouped.get(null) ?? []}
              team={team}
              onTapMember={(master) =>
                router.push(
                  `/dashboard/teams/${team.id}/masters/${master.id}`,
                )
              }
            />
          )}
        </>
      )}

      {/* ── Add master ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          if (availableMasters.length === 0) return;
          setPickerOpen(true);
        }}
        disabled={availableMasters.length === 0}
        className="w-full h-12 rounded-[var(--radius-card)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale shadow-[var(--shadow-card)] flex items-center justify-center gap-2 disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
      >
        <Plus size={16} strokeWidth={2.5} />
        Добавить мастера
      </button>
      {availableMasters.length === 0 && members.length > 0 && (
        <div className="text-[12px] text-[var(--label-tertiary)] leading-snug px-4">
          Все активные мастера уже в команде. Новых заведите в разделе
          «Мастера».
        </div>
      )}

      {/* Picker */}
      {pickerOpen && (
        <AddMemberPicker
          availableMasters={availableMasters}
          roles={roles}
          onAdd={addMember}
          onCreateRole={createRole}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Edit role for existing member */}
      {editingMember && (
        <EditMemberRolePicker
          member={editingMember}
          master={
            masters.find((m) => m.id === editingMember.master_id) ?? null
          }
          roles={roles}
          onPick={setMemberRole}
          onCreateRole={createRole}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* Phase I47 — tap on member now navigates to the dedicated
          access editor page (`[masterId]/page.tsx`), so the inline
          MemberDetailSheet is gone. */}

      {/* Role editor */}
      {editingRole && (
        <RoleEditor
          initial={editingRole.id === null ? null : editingRole}
          onSave={(name, color) => {
            if (editingRole.id === null) {
              createRole(name, color);
            } else {
              updateRole(editingRole.id, name, color);
            }
            setEditingRole(null);
          }}
          onDelete={
            editingRole.id
              ? () => {
                  const rid = editingRole.id as string;
                  setEditingRole(null);
                  deleteRole(rid);
                }
              : undefined
          }
          onClose={() => setEditingRole(null)}
        />
      )}

      <ContextMenu
        open={!!roleMenu}
        onClose={() => setRoleMenu(null)}
        anchor={roleMenu?.anchor ?? null}
        title={roleMenu?.role.name}
        options={roleMenuOptions}
      />
    </BrigadeSectionShell>
  );
}

// ─── Role group with header + edit affordance ──────────────────

function RoleGroup({
  role,
  people,
  team,
  onTapMember,
  onEditRole,
  onLongPressRole,
}: {
  role: BrigadeRole | null;
  people: Master[];
  team: Team;
  onTapMember: (master: Master) => void;
  onEditRole?: () => void;
  onLongPressRole?: (anchor: { x: number; y: number }) => void;
}) {
  const label = role ? role.name.toUpperCase() : "БЕЗ РОЛИ";
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 pb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] flex items-center gap-2 flex-1 min-w-0">
          {role?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: role.color }}
            />
          )}
          <span className="truncate">{label}</span>
        </span>
        {role && onEditRole && (
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              onEditRole();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onLongPressRole?.({ x: e.clientX, y: e.clientY });
            }}
            aria-label={`Редактировать роль ${label}`}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
        )}
      </div>
      {people.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3 text-[12px] text-[var(--label-tertiary)]">
          В этой роли пока никого.
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {people.map((m) => (
            <MemberRow
              key={m.id}
              master={m}
              team={team}
              roleColor={role?.color}
              onTap={() => onTapMember(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  master,
  team,
  roleColor,
  onTap,
}: {
  master: Master;
  team: Team;
  roleColor?: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-[var(--fill-quaternary)] transition text-left"
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px] shrink-0"
        style={{
          backgroundColor: team.color,
          // Ring in role colour — surface (gap) + role-color (2-px ring).
          boxShadow: roleColor
            ? `0 0 0 2px var(--surface-card), 0 0 0 4px ${roleColor}`
            : undefined,
        }}
      >
        {getInitials(master.full_name)}
      </span>
      <span className="flex-1 text-[15px] font-medium text-[var(--label)] truncate">
        {master.full_name}
      </span>
      <ChevronRight
        size={16}
        className="text-[var(--label-quaternary)] shrink-0"
      />
    </button>
  );
}

// ─── Add-member picker with search ─────────────────────────────

function AddMemberPicker({
  availableMasters,
  roles,
  onAdd,
  onCreateRole,
  onClose,
}: {
  availableMasters: Master[];
  roles: BrigadeRole[];
  onAdd: (masterId: string, roleId: string) => void;
  onCreateRole: (name: string, color: string) => BrigadeRole;
  onClose: () => void;
}) {
  const [masterId, setMasterId] = useState<string | null>(null);
  // Role is required now — no «Без роли» path when adding.
  const [roleId, setRoleId] = useState<string | null>(null);
  // Inline role creation state (like service groups)
  const [inlineRoleOpen, setInlineRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState(PRESET_COLORS[0].value);
  // View state — main form vs master selection popup
  const [view, setView] = useState<"main" | "masters">("main");

  const canAdd = masterId !== null && roleId !== null;
  const pickedMaster = masterId
    ? availableMasters.find((m) => m.id === masterId)
    : null;
  const pickedRole = roleId ? roles.find((r) => r.id === roleId) : null;

  const handleAdd = () => {
    if (!canAdd || !roleId || !masterId) return;
    onAdd(masterId, roleId);
  };

  const commitNewRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    const created = onCreateRole(trimmed, newRoleColor);
    setRoleId(created.id);
    setNewRoleName("");
    setNewRoleColor(PRESET_COLORS[0].value);
    setInlineRoleOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "main" ? (
          <>
            <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
              <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
                Добавить мастера
              </div>
              <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
                Сначала роль — потом выберете мастера.
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Role picker (top, inline like service groups) */}
              <section>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                  Роль в команде
                </div>
                <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
                  {roles.map((r) => (
                    <RolePickRow
                      key={r.id}
                      label={r.name}
                      picked={roleId === r.id}
                      onSelect={() => setRoleId(r.id)}
                      color={r.color}
                    />
                  ))}
                  {inlineRoleOpen ? (
                    <div className="px-3 py-2.5 bg-[var(--fill-tertiary)] space-y-2">
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitNewRole();
                          if (e.key === "Escape") {
                            setInlineRoleOpen(false);
                            setNewRoleName("");
                          }
                        }}
                        placeholder="Название роли"
                        autoFocus
                        className="w-full h-9 px-3 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        maxLength={40}
                      />
                      <div className="grid grid-cols-7 gap-1.5">
                        {PRESET_COLORS.map((c) => {
                          const picked = c.value === newRoleColor;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setNewRoleColor(c.value)}
                              aria-label={c.name}
                              className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                              style={{ backgroundColor: c.value }}
                            >
                              {picked && (
                                <Check
                                  size={12}
                                  strokeWidth={3}
                                  className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={commitNewRole}
                          disabled={!newRoleName.trim()}
                          className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-[13px] font-semibold text-[var(--label-on-accent)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
                        >
                          Создать роль
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineRoleOpen(false);
                            setNewRoleName("");
                          }}
                          className="h-9 px-3 rounded-[8px] bg-[var(--fill-secondary)] text-[13px] text-[var(--label)] press-scale"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInlineRoleOpen(true)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left active:bg-[var(--fill-quaternary)] transition"
                    >
                      <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                        <Plus size={14} strokeWidth={2.5} />
                      </span>
                      <span className="flex-1 text-[14px] font-medium text-[var(--accent)]">
                        Новая роль
                      </span>
                    </button>
                  )}
                </div>
              </section>

              {/* Master trigger — opens secondary popup */}
              <section>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                  Мастер
                </div>
                <button
                  type="button"
                  onClick={() => setView("masters")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-[10px] bg-[var(--surface-card)] active:bg-[var(--fill-quaternary)] transition"
                >
                  {pickedMaster ? (
                    <>
                      <span className="w-7 h-7 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {getInitials(pickedMaster.full_name)}
                      </span>
                      <span className="flex-1 text-left text-[14px] text-[var(--label)] truncate">
                        {pickedMaster.full_name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-7 h-7 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center shrink-0">
                        <User size={14} strokeWidth={2} />
                      </span>
                      <span className="flex-1 text-left text-[14px] text-[var(--label-tertiary)]">
                        Выберите мастера
                      </span>
                    </>
                  )}
                  <ChevronRight
                    size={14}
                    className="text-[var(--label-quaternary)]"
                  />
                </button>
              </section>
            </div>

            <div className="px-4 pb-4 pt-1 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:pointer-events-none"
              >
                Добавить
              </button>
            </div>
          </>
        ) : (
          // Secondary view: master list
          <>
            <div className="px-2 pt-3 pb-2 bg-[var(--surface-card)] border-b border-[var(--separator)] flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setView("main")}
                aria-label="Назад"
                className="w-10 h-10 flex items-center justify-center text-[var(--accent)] press-scale"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <div className="flex-1 text-center text-[17px] font-semibold text-[var(--label)] tracking-tight">
                Мастер
              </div>
              <span className="w-10 h-10" aria-hidden />
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {availableMasters.length === 0 ? (
                <div className="bg-[var(--surface-card)] rounded-[10px] px-4 py-8 text-center text-[13px] text-[var(--label-tertiary)]">
                  Нет доступных мастеров. Все уже в этой команде.
                </div>
              ) : (
                <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
                  {availableMasters.map((m) => {
                    const picked = masterId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMasterId(m.id);
                          setView("main");
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-left transition ${
                          picked
                            ? "bg-[var(--accent-tint)]"
                            : "active:bg-[var(--fill-quaternary)]"
                        }`}
                      >
                        <span className="w-9 h-9 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center text-[12px] font-semibold shrink-0">
                          {getInitials(m.full_name)}
                        </span>
                        <span
                          className={`flex-1 text-[14px] truncate ${
                            picked
                              ? "text-[var(--accent)] font-semibold"
                              : "text-[var(--label)]"
                          }`}
                        >
                          {m.full_name}
                        </span>
                        {picked && (
                          <Check
                            size={16}
                            strokeWidth={2.5}
                            className="text-[var(--accent)] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        {/* Current role indicator under header (when Main) */}
        {view === "main" && pickedRole && (
          <div className="sr-only" aria-label={`Выбрана роль ${pickedRole.name}`} />
        )}
      </div>
    </div>
  );
}

function RolePickRow({
  label,
  picked,
  onSelect,
  color,
}: {
  label: string;
  picked: boolean;
  onSelect: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left transition ${
        picked
          ? "bg-[var(--accent-tint)]"
          : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <span
        className="w-6 h-6 rounded-full shrink-0"
        style={{ background: color ?? "var(--fill-secondary)" }}
      />
      <span
        className={`flex-1 text-[14px] ${
          picked
            ? "text-[var(--accent)] font-semibold"
            : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      {picked && (
        <Check size={16} strokeWidth={2.5} className="text-[var(--accent)]" />
      )}
    </button>
  );
}

// ─── Edit member-role picker (smaller sheet) ──────────────────

function EditMemberRolePicker({
  member,
  master,
  roles,
  onPick,
  onCreateRole,
  onClose,
}: {
  member: BrigadeMember;
  master: Master | null;
  roles: BrigadeRole[];
  onPick: (masterId: string, roleId: string | null) => void;
  onCreateRole: (name: string, color: string) => BrigadeRole;
  onClose: () => void;
}) {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);

  const commitNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = onCreateRole(trimmed, newColor);
    onPick(member.master_id, created.id);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Роль в команде
          </div>
          {master && (
            <div className="mt-1 text-[12px] text-[var(--label-tertiary)]">
              {master.full_name}
            </div>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
            {roles.map((r) => (
              <RolePickRow
                key={r.id}
                label={r.name}
                picked={member.role_id === r.id}
                onSelect={() => onPick(member.master_id, r.id)}
                color={r.color}
              />
            ))}
            {inlineOpen ? (
              <div className="px-3 py-2.5 bg-[var(--fill-tertiary)] space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNew();
                    if (e.key === "Escape") {
                      setInlineOpen(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Название роли"
                  autoFocus
                  className="w-full h-9 px-3 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  maxLength={40}
                />
                <div className="grid grid-cols-7 gap-1.5">
                  {PRESET_COLORS.map((c) => {
                    const picked = c.value === newColor;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewColor(c.value)}
                        aria-label={c.name}
                        className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                        style={{ backgroundColor: c.value }}
                      >
                        {picked && (
                          <Check
                            size={12}
                            strokeWidth={3}
                            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={commitNew}
                    disabled={!newName.trim()}
                    className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-[13px] font-semibold text-[var(--label-on-accent)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
                  >
                    Создать и назначить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineOpen(false);
                      setNewName("");
                    }}
                    className="h-9 px-3 rounded-[8px] bg-[var(--fill-secondary)] text-[13px] text-[var(--label)] press-scale"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInlineOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left active:bg-[var(--fill-quaternary)] transition"
              >
                <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <Plus size={14} strokeWidth={2.5} />
                </span>
                <span className="flex-1 text-[14px] font-medium text-[var(--accent)]">
                  Новая роль
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase I47 — MemberDetailSheet removed. Tap on member now routes
// to /dashboard/teams/[id]/masters/[masterId] (full-page access
// editor). Remove and role-change actions live on that page.

function RoleEditor({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: BrigadeRole | null;
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? PRESET_COLORS[0].value,
  );
  const canSave = name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            {initial ? "Редактировать роль" : "Новая роль"}
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Название и цвет. Название видят все, кто заходит в эту
            команду.
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например «Установщик»"
            autoFocus
            maxLength={40}
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />

          <div className="bg-[var(--surface-card)] rounded-[10px] p-3">
            <div className="text-[11px] text-[var(--label-secondary)] mb-2">
              Цвет
            </div>
            <div className="grid grid-cols-7 gap-2">
              {PRESET_COLORS.map((c) => {
                const picked = c.value === color;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-label={c.name}
                    className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                    style={{ backgroundColor: c.value }}
                  >
                    {picked && (
                      <Check
                        size={14}
                        strokeWidth={3}
                        className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
          >
            Отмена
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="h-11 w-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--system-red)] flex items-center justify-center press-scale"
              aria-label="Удалить роль"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => canSave && onSave(name, color)}
            disabled={!canSave}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:pointer-events-none"
          >
            {initial ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
