"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
  ROLE_LABELS,
  SALARY_MODEL_LABELS,
  SALARY_UNIT,
  getInitials,
  type Master,
  type MasterRole,
  type Team,
} from "@/lib/masters";
import MasterSheet from "./MasterSheet";

const ROLE_COLORS: Record<MasterRole, string> = {
  admin: "bg-[var(--system-red)]",
  dispatcher: "bg-[var(--system-orange)]",
  lead: "bg-[var(--accent)]",
  helper: "bg-[var(--fill-primary)]",
};

// Sprint 026: Мастера is its own page now — sibling to Бригады, not
// a subsection. Adding a new row opens MasterSheet which covers all
// employment fields (salary, permissions, documents, notes).
export default function MastersPage() {
  const router = useRouter();
  const { masters, upsertMaster, deleteMaster } = useMasters();
  const { teams, setTeams } = useTeams();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Master | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  // Deep-link ?edit=<id> opens the sheet for that master — used by
  // other surfaces (e.g. the brigade detail card) without forcing a
  // second tap to find them in the list.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    const master = masters.find((m) => m.id === editId);
    if (master) {
      setEditing(master);
      setShowForm(true);
    }
    router.replace("/dashboard/masters");
  }, [masters, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return masters;
    return masters.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.email?.toLowerCase().includes(q) ?? false)
    );
  }, [masters, query]);

  const { active, inactive } = useMemo(() => {
    const a: Master[] = [];
    const i: Master[] = [];
    filtered.forEach((m) => (m.is_active ? a.push(m) : i.push(m)));
    return { active: a, inactive: i };
  }, [filtered]);

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

  const handleDelete = async (master: Master) => {
    const ok = await confirm({
      title: `Удалить сотрудника «${master.full_name}»?`,
      message: "Будет удалён из всех бригад где состоял. Отменить нельзя.",
    });
    if (!ok) return;
    deleteMaster(master.id);

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

  return (
    <>
      <PageHeader
        title="Мастера"
        subtitle={`${masters.length} ${masters.length === 1 ? "сотрудник" : "сотрудников"}`}
        rightContent={
          <button
            type="button"
            onClick={openNew}
            aria-label="Добавить сотрудника"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-on-accent)] lg:text-[var(--label)] hover:bg-[var(--accent)] lg:hover:bg-[var(--fill-primary)]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--fill-tertiary)] relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-4">
          {/* Search */}
          <div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, телефону или email"
              className="w-full h-11 px-3 rounded-xl bg-[var(--surface-card)] border border-[var(--separator)] text-[13px] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <ListGroup title={`Активные (${active.length})`}>
            {active.length === 0 ? (
              <Empty>
                {query ? "Ничего не найдено" : "Нет активных сотрудников"}
              </Empty>
            ) : (
              active.map((m) => (
                <MasterRow
                  key={m.id}
                  master={m}
                  team={m.team_id ? teams.find((t) => t.id === m.team_id) ?? null : null}
                  onOpen={() => openEdit(m)}
                />
              ))
            )}
          </ListGroup>

          <ListGroup title={`Неактивные (${inactive.length})`}>
            {inactive.length === 0 ? (
              <Empty>Нет неактивных</Empty>
            ) : (
              inactive.map((m) => (
                <MasterRow
                  key={m.id}
                  master={m}
                  team={m.team_id ? teams.find((t) => t.id === m.team_id) ?? null : null}
                  onOpen={() => openEdit(m)}
                />
              ))
            )}
          </ListGroup>
        </div>
      </div>

      {showForm && (
        <MasterSheet
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

function ListGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wide px-1 mb-2">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden divide-y divide-[var(--separator)]">
        {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-[var(--label-tertiary)] py-8 text-sm">{children}</div>
  );
}

function MasterRow({
  master,
  team,
  onOpen,
}: {
  master: Master;
  team: Team | null;
  onOpen: () => void;
}) {
  const salaryLabel = master.salary
    ? master.salary.model === "percent_of_team"
      ? "через бригаду"
      : `${master.salary.value} ${SALARY_UNIT[master.salary.model]} · ${SALARY_MODEL_LABELS[master.salary.model]}`
    : "ЗП не задана";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--fill-tertiary)] text-left"
    >
      <div
        className={`w-10 h-10 rounded-full text-[var(--label-on-accent)] flex items-center justify-center font-bold text-[12px] shrink-0 ${ROLE_COLORS[master.role]}`}
      >
        {getInitials(master.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {master.full_name}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate">
          {ROLE_LABELS[master.role]}
          {team ? (
            <>
              {" · "}
              <span style={{ color: team.color }} className="font-semibold">
                {team.name}
              </span>
            </>
          ) : (
            " · без бригады"
          )}
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] truncate tabular-nums">
          {master.phone || "—"}
          {master.email ? ` · ${master.email}` : ""}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {master.account_status && (
          <span
            className={`text-[12px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ACCOUNT_STATUS_TONE[master.account_status]}`}
          >
            {ACCOUNT_STATUS_LABELS[master.account_status]}
          </span>
        )}
        <span className="text-[12px] font-semibold text-[var(--label-secondary)] bg-[var(--fill-primary)] rounded-full px-2 py-0.5 whitespace-nowrap">
          {salaryLabel}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-[var(--label-quaternary)]"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}
