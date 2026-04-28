"use client";

// Sprint 033 Phase I47 — Brigade Member access editor.
//
// Full page (not modal) per user spec: «если кликать на мастера —
// переход на новую страницу где настраиваешь мастера под эту бригаду».
//
// Structure:
//  · Header: avatar (team tint + role ring) + name + role chip + edit
//    role shortcut
//  · Three presets at top — Полный доступ / Только смотреть / Сброс
//  · Grouped permission list (12 sections, ~50 flags)
//    Parent rows gate their indented children: when parent is OFF the
//    children render disabled.
//  · «Убрать из бригады» at the bottom (destructive)

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Pencil,
  Plus,
  UserMinus,
  X,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";
import { useMasters, useTeams } from "@/components/layout/DashboardClientLayout";
import {
  generateId,
  getInitials,
  type BrigadeMember,
  type BrigadeRole,
  type Master,
  type Team,
} from "@babun/shared/local/masters";
import {
  BRIGADE_PERMISSION_GROUPS,
  DEFAULT_BRIGADE_MEMBER_PERMISSIONS,
  READ_ONLY_BRIGADE_MEMBER_PERMISSIONS,
  countEnabled,
  resolveMemberPermissions,
  type BrigadeMemberPermissions,
  type BrigadePermissionKey,
  type FlagRow,
} from "@babun/shared/local/brigade-permissions";

interface RouteParams {
  params: Promise<{ id: string; masterId: string }>;
}

export default function BrigadeMemberAccessPage({ params }: RouteParams) {
  const { id, masterId } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { teams, upsertTeam } = useTeams();
  const { masters } = useMasters();

  const team = teams.find((t) => t.id === id);
  const master = masters.find((m) => m.id === masterId) ?? null;

  const [roleEditorOpen, setRoleEditorOpen] = useState(false);

  const member = team?.members?.find((m) => m.master_id === masterId) ?? null;
  const roles: BrigadeRole[] = team?.roles ?? [];
  const role = member?.role_id
    ? roles.find((r) => r.id === member.role_id) ?? null
    : null;

  const permissions = useMemo(
    () => resolveMemberPermissions(member?.permissions),
    [member?.permissions],
  );
  const counts = useMemo(() => countEnabled(permissions), [permissions]);

  // ── Guards ─────────────────────────────────────────────────────
  if (!team || !master || !member) {
    return (
      <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
        <TopBar onBack={() => router.back()} title="Доступ" />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="text-[17px] font-semibold text-[var(--label)] mb-2">
              Участник не найден
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
            >
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Persist ───────────────────────────────────────────────────
  const persistPermissions = (next: BrigadeMemberPermissions) => {
    if (!team) return;
    const nextMembers = (team.members ?? []).map((mm) =>
      mm.master_id === masterId ? { ...mm, permissions: next } : mm,
    );
    upsertTeam({ ...team, members: nextMembers });
  };

  const persistRole = (roleId: string | null) => {
    if (!team) return;
    const nextMembers = (team.members ?? []).map((mm) =>
      mm.master_id === masterId ? { ...mm, role_id: roleId } : mm,
    );
    // Legacy sync.
    const leadRoleIds = new Set(
      (team.roles ?? [])
        .filter((r) => r.name.trim().toLowerCase() === "бригадир")
        .map((r) => r.id),
    );
    const leadIds: string[] = [];
    const helperIds: string[] = [];
    for (const mm of nextMembers) {
      if (mm.role_id && leadRoleIds.has(mm.role_id)) leadIds.push(mm.master_id);
      else helperIds.push(mm.master_id);
    }
    upsertTeam({
      ...team,
      members: nextMembers,
      lead_id: leadIds[0] ?? null,
      lead_ids: leadIds,
      helper_ids: helperIds,
    });
  };

  const createRole = (name: string, color: string): BrigadeRole => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("empty role name");
    const existing = (team.roles ?? []).find(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const next: BrigadeRole = {
      id: generateId("role"),
      name: trimmed,
      color,
    };
    upsertTeam({ ...team, roles: [...(team.roles ?? []), next] });
    return next;
  };

  // ── Flag handlers ─────────────────────────────────────────────
  const toggleFlag = (key: BrigadePermissionKey) => {
    haptic("tap");
    persistPermissions({ ...permissions, [key]: !permissions[key] });
  };

  const applyPreset = (preset: "full" | "read" | "default") => {
    haptic("tap");
    if (preset === "full") {
      persistPermissions(DEFAULT_BRIGADE_MEMBER_PERMISSIONS);
    } else if (preset === "read") {
      persistPermissions(READ_ONLY_BRIGADE_MEMBER_PERMISSIONS);
    } else {
      // Reset — also full access (backward compat stance).
      persistPermissions(DEFAULT_BRIGADE_MEMBER_PERMISSIONS);
    }
  };

  // ── Remove from brigade ───────────────────────────────────────
  const handleRemove = async () => {
    const ok = await confirm({
      title: `Убрать ${master.full_name} из бригады?`,
      message:
        "Мастер останется в разделе Мастера, но больше не будет в этой бригаде.",
      confirmLabel: "Убрать",
    });
    if (!ok) return;
    haptic("warning");
    const nextMembers = (team.members ?? []).filter(
      (mm) => mm.master_id !== masterId,
    );
    // Legacy sync — recompute lead/helper arrays without this master.
    const leadRoleIds = new Set(
      (team.roles ?? [])
        .filter((r) => r.name.trim().toLowerCase() === "бригадир")
        .map((r) => r.id),
    );
    const leadIds: string[] = [];
    const helperIds: string[] = [];
    for (const mm of nextMembers) {
      if (mm.role_id && leadRoleIds.has(mm.role_id)) leadIds.push(mm.master_id);
      else helperIds.push(mm.master_id);
    }
    upsertTeam({
      ...team,
      members: nextMembers,
      lead_id: leadIds[0] ?? null,
      lead_ids: leadIds,
      helper_ids: helperIds,
    });
    router.push(`/dashboard/teams/${team.id}/masters`);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      <TopBar onBack={() => router.back()} title="Доступ" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+100px)] space-y-5">
          {/* ── Header ─────────────────────────────── */}
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-5 pt-5 pb-4 text-center">
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[22px] mx-auto mb-2"
              style={{
                backgroundColor: team.color,
                boxShadow: role?.color
                  ? `0 0 0 2px var(--surface-card), 0 0 0 4px ${role.color}`
                  : undefined,
              }}
            >
              {getInitials(master.full_name)}
            </span>
            <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
              {master.full_name}
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
              В бригаде «{team.name}»
            </div>
            <button
              type="button"
              onClick={() => setRoleEditorOpen(true)}
              className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[var(--fill-tertiary)] text-[13px] text-[var(--label)] press-scale"
            >
              {role?.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: role.color }}
                />
              )}
              <span className="font-medium">
                {role?.name ?? "Без роли"}
              </span>
              <Pencil size={12} strokeWidth={2} className="text-[var(--label-secondary)]" />
            </button>
          </div>

          {/* ── Presets ─────────────────────────── */}
          <div>
            <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
              Пресет
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset("full")}
                className="h-10 rounded-[10px] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--label)] press-scale shadow-[var(--shadow-card)]"
              >
                Полный
              </button>
              <button
                type="button"
                onClick={() => applyPreset("read")}
                className="h-10 rounded-[10px] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--label)] press-scale shadow-[var(--shadow-card)]"
              >
                Только смотреть
              </button>
              <button
                type="button"
                onClick={() => applyPreset("default")}
                className="h-10 rounded-[10px] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--label)] press-scale shadow-[var(--shadow-card)]"
              >
                Сброс
              </button>
            </div>
            <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
              Включено {counts.on} из {counts.total} прав.
            </div>
          </div>

          {/* ── Permission groups ────────────────── */}
          {BRIGADE_PERMISSION_GROUPS.map((group) => {
            const parentOn = group.parent
              ? permissions[group.parent]
              : true;
            return (
              <div key={group.id}>
                <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] flex items-center gap-1.5">
                  <span aria-hidden>{group.emoji}</span>
                  <span>{group.title}</span>
                </div>
                <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
                  {group.rows.map((row) => {
                    const disabled = Boolean(row.indent && !parentOn);
                    return (
                      <FlagRowView
                        key={row.key}
                        row={row}
                        value={permissions[row.key]}
                        disabled={disabled}
                        onToggle={() => toggleFlag(row.key)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Remove ─────────────────────────── */}
          <button
            type="button"
            onClick={handleRemove}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--system-red)] text-[15px] font-medium press-scale active:bg-[rgba(255,59,48,0.08)] shadow-[var(--shadow-card)]"
          >
            <UserMinus size={16} strokeWidth={2} />
            Убрать из бригады
          </button>
        </div>
      </div>

      {roleEditorOpen && (
        <RolePickerSheet
          currentRoleId={member.role_id}
          roles={roles}
          masterName={master.full_name}
          onPick={(rid) => {
            persistRole(rid);
            setRoleEditorOpen(false);
          }}
          onCreateRole={createRole}
          onClose={() => setRoleEditorOpen(false)}
        />
      )}
    </div>
  );
}

// ─── TopBar ────────────────────────────────────────────────────

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад"
        className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
      </button>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center">
        {title}
      </h1>
      <span className="ml-auto w-11 h-11" aria-hidden />
    </div>
  );
}

// ─── Single flag row ───────────────────────────────────────────

function FlagRowView({
  row,
  value,
  disabled,
  onToggle,
}: {
  row: FlagRow;
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 min-h-[52px] px-4 py-2.5 ${
        row.indent ? "pl-8" : ""
      } ${disabled ? "opacity-40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-[var(--label)] leading-snug">
          {row.label}
        </div>
        {row.description && (
          <div className="text-[11px] text-[var(--label-tertiary)] leading-snug mt-0.5">
            {row.description}
          </div>
        )}
      </div>
      <IOSSwitch
        checked={value}
        onChange={onToggle}
        disabled={disabled}
        ariaLabel={row.label}
      />
    </div>
  );
}

// ─── Role-picker sub-sheet (with inline create) ───────────────

function RolePickerSheet({
  currentRoleId,
  roles,
  masterName,
  onPick,
  onCreateRole,
  onClose,
}: {
  currentRoleId: string | null;
  roles: BrigadeRole[];
  masterName: string;
  onPick: (roleId: string | null) => void;
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
    onPick(created.id);
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
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)]">
            {masterName}
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)]">
            {roles.map((r) => (
              <RolePickRow
                key={r.id}
                label={r.name}
                picked={currentRoleId === r.id}
                onSelect={() => onPick(r.id)}
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
                    className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-[13px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40"
                  >
                    Создать и назначить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineOpen(false);
                      setNewName("");
                    }}
                    className="h-9 w-9 rounded-[8px] bg-[var(--fill-secondary)] text-[var(--label-secondary)] flex items-center justify-center"
                    aria-label="Отмена"
                  >
                    <X size={14} strokeWidth={2.5} />
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

// unused param keepers
void ({} as { Master: Master; Team: Team });
