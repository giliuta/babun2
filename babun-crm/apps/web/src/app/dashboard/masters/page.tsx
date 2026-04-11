"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  defaultPermissionsForRole,
  generateId,
  getInitials,
  type Master,
  type MasterPermissions,
  type MasterRole,
  type Team,
} from "@/lib/masters";

const ROLE_COLORS: Record<MasterRole, string> = {
  admin: "bg-red-500",
  dispatcher: "bg-amber-500",
  lead: "bg-blue-500",
  helper: "bg-gray-500",
};

// ─── Page ────────────────────────────────────────────────────────────────

export default function MastersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masters, upsertMaster, deleteMaster } = useMasters();
  const { teams, setTeams } = useTeams();

  const [editing, setEditing] = useState<Master | null>(null);
  const [showForm, setShowForm] = useState(false);

  // If another page linked with ?edit=<id>, open that master's edit modal
  // and scrub the query so a refresh doesn't re-trigger it.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const master = masters.find((m) => m.id === editId);
    if (master) {
      setEditing(master);
      setShowForm(true);
    }
    router.replace("/dashboard/masters");
  }, [searchParams, masters, router]);

  const { active, inactive } = useMemo(() => {
    const a: Master[] = [];
    const i: Master[] = [];
    masters.forEach((m) => (m.is_active ? a.push(m) : i.push(m)));
    return { active: a, inactive: i };
  }, [masters]);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (master: Master) => {
    setEditing(master);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = (master: Master) => {
    upsertMaster(master);
    closeForm();
  };

  const handleDelete = (master: Master) => {
    if (!window.confirm(`Удалить мастера "${master.full_name}"?`)) return;
    deleteMaster(master.id);

    // Remove references from teams (lead_id or helper_ids)
    const updatedTeams = teams.map<Team>((t) => {
      let changed = false;
      let nextLeadId = t.lead_id;
      let nextHelperIds = t.helper_ids;

      if (t.lead_id === master.id) {
        nextLeadId = null;
        changed = true;
      }
      if (t.helper_ids.includes(master.id)) {
        nextHelperIds = t.helper_ids.filter((id) => id !== master.id);
        changed = true;
      }

      return changed ? { ...t, lead_id: nextLeadId, helper_ids: nextHelperIds } : t;
    });
    setTeams(updatedTeams);
    closeForm();
  };

  const renderRow = (master: Master) => {
    const team = master.team_id
      ? teams.find((t) => t.id === master.team_id)
      : null;
    return (
      <button
        key={master.id}
        type="button"
        onClick={() => openEdit(master)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
      >
        <div
          className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${ROLE_COLORS[master.role]}`}
        >
          {getInitials(master.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {master.full_name}
          </div>
          <div className="text-[11px] text-gray-500">
            {ROLE_LABELS[master.role]}
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {master.phone || "—"}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {team ? (
            <span
              className="inline-block text-[11px] px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
              style={{ backgroundColor: team.color }}
            >
              {team.name}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">—</span>
          )}
          <span
            aria-label="Редактировать"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
        </div>
      </button>
    );
  };

  return (
    <>
      <PageHeader
        title="Мастера"
        rightContent={
          <button
            type="button"
            onClick={openNew}
            aria-label="Добавить мастера"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-4">
          {/* Active */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">
              Активные ({active.length})
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {active.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  Нет активных мастеров
                </div>
              ) : (
                active.map(renderRow)
              )}
            </div>
          </div>

          {/* Inactive */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">
              Неактивные ({inactive.length})
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {inactive.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  Нет неактивных мастеров
                </div>
              ) : (
                inactive.map(renderRow)
              )}
            </div>
          </div>
        </div>

      </div>

      {showForm && (
        <MasterFormModal
          key={editing?.id ?? "new"}
          master={editing}
          teams={teams}
          onCancel={closeForm}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

// ─── Master Form Modal ──────────────────────────────────────────────────

function MasterFormModal({
  master,
  teams,
  onCancel,
  onSave,
  onDelete,
}: {
  master: Master | null;
  teams: Team[];
  onCancel: () => void;
  onSave: (master: Master) => void;
  onDelete: (master: Master) => void;
}) {
  const isEditing = !!master;

  const [fullName, setFullName] = useState(master?.full_name ?? "");
  const [phone, setPhone] = useState(master?.phone ?? "");
  const [teamId, setTeamId] = useState<string | null>(master?.team_id ?? null);
  const [role, setRole] = useState<MasterRole>(master?.role ?? "helper");
  const [isActive, setIsActive] = useState(master?.is_active ?? true);
  const [permissions, setPermissions] = useState<MasterPermissions>(
    master?.permissions ?? defaultPermissionsForRole("helper"),
  );
  const [permsOpen, setPermsOpen] = useState(true);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleRoleChange = (nextRole: MasterRole) => {
    setRole(nextRole);
    setPermissions(defaultPermissionsForRole(nextRole));
  };

  const togglePermission = (
    key: keyof Omit<MasterPermissions, "visible_team_ids">,
  ) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allTeamsVisible = permissions.visible_team_ids.includes("*");

  const toggleAllTeamsVisible = () => {
    setPermissions((prev) => ({
      ...prev,
      visible_team_ids: prev.visible_team_ids.includes("*") ? [] : ["*"],
    }));
  };

  const toggleTeamVisible = (teamId: string) => {
    setPermissions((prev) => {
      if (prev.visible_team_ids.includes("*")) return prev;
      const has = prev.visible_team_ids.includes(teamId);
      return {
        ...prev,
        visible_team_ids: has
          ? prev.visible_team_ids.filter((id) => id !== teamId)
          : [...prev.visible_team_ids, teamId],
      };
    });
  };

  const handleSubmit = () => {
    if (!fullName.trim()) {
      window.alert("Введите ФИО мастера");
      return;
    }

    const nowIso = new Date().toISOString();
    const nextMaster: Master = {
      id: master?.id ?? generateId("m"),
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: master?.avatar_url ?? null,
      team_id: teamId,
      role,
      is_active: isActive,
      permissions,
      created_at: master?.created_at ?? nowIso,
    };

    onSave(nextMaster);
  };

  void PERMISSION_LABELS;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-end lg:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {isEditing ? "Редактировать мастера" : "Новый мастер"}
        </h2>

        <div className="space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              ФИО <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Телефон</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Team */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Бригада</label>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Без бригады —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as MasterRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(Object.keys(ROLE_LABELS) as MasterRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Активен</span>
            <ToggleSwitch checked={isActive} onChange={setIsActive} />
          </div>

          {/* Permissions section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              type="button"
              onClick={() => setPermsOpen((p) => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800"
            >
              <span>Доступы</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${permsOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {permsOpen && (
              <div className="px-3 pb-3 space-y-4 border-t border-gray-100 pt-3">
                {PERMISSION_GROUPS.filter((g) => g.permissions.length > 0).map((group) => (
                  <div key={group.key}>
                    <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide mb-1">
                      {group.title}
                    </div>
                    <div className="text-[11px] text-gray-500 mb-2">{group.description}</div>
                    <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                      {group.permissions.map((key) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700">
                            {PERMISSION_LABELS[key]}
                          </span>
                          <ToggleSwitch
                            checked={permissions[key]}
                            onChange={() => togglePermission(key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Visible teams */}
                <div className="pt-2">
                  <div className="text-xs text-gray-500 mb-2">
                    Видимые бригады
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={toggleAllTeamsVisible}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                        allTeamsVisible
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      Все
                    </button>
                    {!allTeamsVisible &&
                      teams.map((t) => {
                        const selected = permissions.visible_team_ids.includes(
                          t.id,
                        );
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTeamVisible(t.id)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                              selected
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {isEditing && master ? (
            <button
              type="button"
              onClick={() => onDelete(master)}
              className="text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Switch ──────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
