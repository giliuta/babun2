"use client";

// Sprint 033 Phase I43 — Brigade masters, custom-roles rework.
//
// Previous incarnation showed every master in the company as a tap-
// to-add list with swipe-right to mark as lead. Per user feedback:
//   «Убрать весь список мастеров. Кнопка "Добавить мастера" → выбрать
//    из списка + назначить роль. Роль создаю сразу (как группа на
//    странице услуг)».
//
// New UX: the page shows people who are already IN this brigade,
// grouped by the brigade's own role taxonomy (Бригадир / Установщик
// / Помощник / whatever). «+ Добавить мастера» opens a picker with
// one combined screen: pick a master from the company list and pick
// (or create on the fly) a role within this brigade. Legacy
// lead_ids/helper_ids are auto-migrated on first touch and kept in
// sync so older readers still see the lead/helper split.

import { use, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  DEFAULT_BRIGADE_ROLES,
  generateId,
  getInitials,
  type BrigadeMember,
  type BrigadeRole,
  type Master,
  type Team,
} from "@/lib/masters";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeMastersPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const { masters } = useMasters();
  const confirm = useConfirm();
  const team = teams.find((t) => t.id === id);

  // ── State ──────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<BrigadeMember | null>(null);
  const [menu, setMenu] = useState<{
    member: BrigadeMember;
    anchor: { x: number; y: number };
  } | null>(null);

  // ── Lazy migration: legacy lead_ids/helper_ids → roles+members ──
  useEffect(() => {
    if (!team) return;
    if (team.members) return; // already migrated
    const legacyLeadIds = team.lead_ids?.length
      ? team.lead_ids.filter(Boolean)
      : team.lead_id
        ? [team.lead_id]
        : [];
    const legacyHelperIds = team.helper_ids ?? [];
    if (legacyLeadIds.length === 0 && legacyHelperIds.length === 0) {
      // New brigade — seed with defaults but empty members
      upsertTeam({ ...team, roles: DEFAULT_BRIGADE_ROLES, members: [] });
      return;
    }
    const members: BrigadeMember[] = [
      ...legacyLeadIds.map((mid) => ({
        master_id: mid,
        role_id: "role-lead",
      })),
      ...legacyHelperIds
        .filter((mid) => !legacyLeadIds.includes(mid))
        .map((mid) => ({ master_id: mid, role_id: "role-helper" })),
    ];
    upsertTeam({
      ...team,
      roles: team.roles ?? DEFAULT_BRIGADE_ROLES,
      members,
    });
  }, [team, upsertTeam]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Мастера" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const roles: BrigadeRole[] = team.roles ?? DEFAULT_BRIGADE_ROLES;
  const members: BrigadeMember[] = team.members ?? [];

  // ── Legacy sync helper ────────────────────────────────────────
  // Keeps lead_id / lead_ids / helper_ids in sync with members so
  // downstream code that still reads those fields keeps working.
  // Role named «Бригадир» (case-insensitive) → lead; everything else
  // → helper.
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

  const persist = (nextRoles: BrigadeRole[], nextMembers: BrigadeMember[]) => {
    const legacy = toLegacy(nextRoles, nextMembers);
    upsertTeam({
      ...team,
      roles: nextRoles,
      members: nextMembers,
      ...legacy,
    });
  };

  // ── Add master (from picker) ─────────────────────────────────
  const addMember = (masterId: string, roleId: string | null) => {
    if (members.some((m) => m.master_id === masterId)) return;
    haptic("tap");
    persist(roles, [...members, { master_id: masterId, role_id: roleId }]);
    setPickerOpen(false);
  };

  // ── Edit member's role ───────────────────────────────────────
  const setMemberRole = (masterId: string, roleId: string | null) => {
    haptic("tap");
    persist(
      roles,
      members.map((m) =>
        m.master_id === masterId ? { ...m, role_id: roleId } : m,
      ),
    );
    setEditing(null);
  };

  // ── Remove member ────────────────────────────────────────────
  const removeMember = async (masterId: string) => {
    const master = masters.find((m) => m.id === masterId);
    const ok = await confirm({
      title: `Убрать ${master?.full_name ?? "мастера"} из бригады?`,
      message:
        "Мастер останется в разделе Мастера, но больше не будет в этой бригаде.",
      confirmLabel: "Убрать",
    });
    if (!ok) return;
    haptic("warning");
    persist(
      roles,
      members.filter((m) => m.master_id !== masterId),
    );
  };

  // ── Create / edit / delete role ─────────────────────────────
  const createRole = (name: string): BrigadeRole => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("empty role name");
    const existing = roles.find(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const next: BrigadeRole = {
      id: generateId("role"),
      name: trimmed,
    };
    persist([...roles, next], members);
    return next;
  };

  // ── Derived groups: role_id → list of Master objects ────────
  const grouped = useMemo(() => {
    const byRole = new Map<string | null, Master[]>();
    byRole.set(null, []);
    for (const r of roles) byRole.set(r.id, []);
    for (const m of members) {
      const master = masters.find((mm) => mm.id === m.master_id);
      if (!master) continue;
      const key = m.role_id && roles.some((r) => r.id === m.role_id) ? m.role_id : null;
      const arr = byRole.get(key) ?? [];
      arr.push(master);
      byRole.set(key, arr);
    }
    return byRole;
  }, [members, roles, masters]);

  const availableMasters = masters.filter(
    (m) => m.is_active && !members.some((mm) => mm.master_id === m.id),
  );

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Изменить роль",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => setEditing(menu.member),
        },
        {
          label: "Убрать из бригады",
          icon: <UserMinus size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => removeMember(menu.member.master_id),
        },
      ]
    : [];

  return (
    <BrigadeSectionShell brigadeId={id} title="Мастера" hideSave>
      {/* ── Empty-state ─────────────────────────────────────── */}
      {members.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-6 py-8 text-center">
          <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center mx-auto mb-3">
            <Users size={28} strokeWidth={2} />
          </span>
          <div className="text-[17px] font-semibold text-[var(--label)]">
            Пусто
          </div>
          <div className="mt-1 text-[13px] text-[var(--label-secondary)] leading-snug">
            Добавьте первого мастера и назначьте ему роль в этой бригаде.
          </div>
        </div>
      ) : (
        <>
          {/* Groups: one section per role that HAS members */}
          {roles.map((role) => {
            const people = grouped.get(role.id) ?? [];
            if (people.length === 0) return null;
            return (
              <RoleGroup
                key={role.id}
                title={role.name.toUpperCase()}
                people={people}
                team={team}
                onLongPress={(master, anchor) =>
                  setMenu({
                    member:
                      members.find((m) => m.master_id === master.id) ??
                      ({ master_id: master.id, role_id: role.id } as BrigadeMember),
                    anchor,
                  })
                }
              />
            );
          })}
          {/* Unassigned bucket */}
          {(grouped.get(null)?.length ?? 0) > 0 && (
            <RoleGroup
              title="БЕЗ РОЛИ"
              people={grouped.get(null) ?? []}
              team={team}
              onLongPress={(master, anchor) =>
                setMenu({
                  member:
                    members.find((m) => m.master_id === master.id) ??
                    ({ master_id: master.id, role_id: null } as BrigadeMember),
                  anchor,
                })
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
        className="w-full h-12 rounded-[var(--radius-card)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale shadow-[var(--shadow-card)] flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <Plus size={16} strokeWidth={2.5} />
        Добавить мастера
      </button>
      {availableMasters.length === 0 && members.length > 0 && (
        <div className="text-[12px] text-[var(--label-tertiary)] leading-snug px-4">
          Все активные мастера уже в бригаде. Новых заведите в разделе
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
      {editing && (
        <EditRolePicker
          member={editing}
          master={masters.find((m) => m.id === editing.master_id) ?? null}
          roles={roles}
          onPick={setMemberRole}
          onCreateRole={createRole}
          onClose={() => setEditing(null)}
        />
      )}

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={
          menu
            ? masters.find((m) => m.id === menu.member.master_id)?.full_name
            : undefined
        }
        options={menuOptions}
      />
    </BrigadeSectionShell>
  );
}

// ─── Role group (iOS section with name + list of members) ──────

function RoleGroup({
  title,
  people,
  team,
  onLongPress,
}: {
  title: string;
  people: Master[];
  team: Team;
  onLongPress: (master: Master, anchor: { x: number; y: number }) => void;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
        {people.map((m) => (
          <MemberRow
            key={m.id}
            master={m}
            team={team}
            onLongPress={(anchor) => onLongPress(m, anchor)}
          />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  master,
  team,
  onLongPress,
}: {
  master: Master;
  team: Team;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const pressedAt = { current: 0, x: 0, y: 0 } as {
    current: number;
    x: number;
    y: number;
  };
  return (
    <button
      type="button"
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress({ x: e.clientX, y: e.clientY });
      }}
      onPointerDown={(e) => {
        pressedAt.current = Date.now();
        pressedAt.x = e.clientX;
        pressedAt.y = e.clientY;
      }}
      onPointerUp={() => {
        const dt = Date.now() - pressedAt.current;
        if (dt > 500) {
          onLongPress({ x: pressedAt.x, y: pressedAt.y });
        }
      }}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-[var(--fill-quaternary)] transition text-left"
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px] shrink-0"
        style={{ backgroundColor: team.color }}
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

// ─── Add-member picker modal ──────────────────────────────────

function AddMemberPicker({
  availableMasters,
  roles,
  onAdd,
  onCreateRole,
  onClose,
}: {
  availableMasters: Master[];
  roles: BrigadeRole[];
  onAdd: (masterId: string, roleId: string | null) => void;
  onCreateRole: (name: string) => BrigadeRole;
  onClose: () => void;
}) {
  const [masterId, setMasterId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false);

  const canAdd = masterId !== null;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(masterId, roleId);
  };

  const commitNewRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    const created = onCreateRole(trimmed);
    setRoleId(created.id);
    setNewRoleName("");
    setInlineCreateOpen(false);
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
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Добавить мастера
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Выберите мастера и назначьте роль в этой бригаде.
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Master list */}
          <section>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
              Мастер
            </div>
            <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)] max-h-[220px] overflow-y-auto">
              {availableMasters.map((m) => {
                const picked = masterId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMasterId(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[48px] text-left transition ${
                      picked
                        ? "bg-[var(--accent-tint)]"
                        : "active:bg-[var(--fill-quaternary)]"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center text-[11px] font-semibold shrink-0">
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
          </section>

          {/* Role picker + inline create */}
          <section>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
              Роль в бригаде
            </div>
            <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
              <RolePickRow
                label="Без роли"
                picked={roleId === null}
                onSelect={() => setRoleId(null)}
              />
              {roles.map((r) => (
                <RolePickRow
                  key={r.id}
                  label={r.name}
                  picked={roleId === r.id}
                  onSelect={() => setRoleId(r.id)}
                  color={r.color}
                />
              ))}
              {inlineCreateOpen ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--fill-tertiary)]">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitNewRole();
                      if (e.key === "Escape") {
                        setInlineCreateOpen(false);
                        setNewRoleName("");
                      }
                    }}
                    placeholder="Название роли"
                    autoFocus
                    className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
                    maxLength={40}
                  />
                  <button
                    type="button"
                    onClick={commitNewRole}
                    disabled={!newRoleName.trim()}
                    className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center press-scale disabled:opacity-40"
                  >
                    <Check size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineCreateOpen(false);
                      setNewRoleName("");
                    }}
                    className="w-9 h-9 rounded-full bg-[var(--fill-secondary)] text-[var(--label-secondary)] flex items-center justify-center"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInlineCreateOpen(true)}
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
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
          >
            Добавить
          </button>
        </div>
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

// ─── Edit-role picker (smaller sheet) ─────────────────────────

function EditRolePicker({
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
  onCreateRole: (name: string) => BrigadeRole;
  onClose: () => void;
}) {
  const [newRoleName, setNewRoleName] = useState("");
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false);

  const pick = (roleId: string | null) => {
    onPick(member.master_id, roleId);
  };

  const commitNewRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    const created = onCreateRole(trimmed);
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
            Роль в бригаде
          </div>
          {master && (
            <div className="mt-1 text-[12px] text-[var(--label-tertiary)]">
              {master.full_name}
            </div>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
            <RolePickRow
              label="Без роли"
              picked={member.role_id === null}
              onSelect={() => pick(null)}
            />
            {roles.map((r) => (
              <RolePickRow
                key={r.id}
                label={r.name}
                picked={member.role_id === r.id}
                onSelect={() => pick(r.id)}
                color={r.color}
              />
            ))}
            {inlineCreateOpen ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--fill-tertiary)]">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNewRole();
                    if (e.key === "Escape") {
                      setInlineCreateOpen(false);
                      setNewRoleName("");
                    }
                  }}
                  placeholder="Название роли"
                  autoFocus
                  className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
                  maxLength={40}
                />
                <button
                  type="button"
                  onClick={commitNewRole}
                  disabled={!newRoleName.trim()}
                  className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center press-scale disabled:opacity-40"
                >
                  <Check size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineCreateOpen(false);
                    setNewRoleName("");
                  }}
                  className="w-9 h-9 rounded-full bg-[var(--fill-secondary)] text-[var(--label-secondary)] flex items-center justify-center"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInlineCreateOpen(true)}
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

// Keep Trash2 import used (for future delete affordance)
void Trash2;
