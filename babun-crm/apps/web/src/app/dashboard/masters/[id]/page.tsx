"use client";

// Sprint 033 Phase I32 — /dashboard/masters/[id] detail hub.
//
// After v279 each row has its own iOS-style subroute:
//   /info          — identity + contacts + Babun account (mega)
//   /employment    — role + brigade + contract + schedule
//   /salary        — pay model + amount + period + method
//   /access        — permissions matrix + brigade visibility
//   /notes         — freeform memo
//
// The hub stays a compact list of nav rows. No more MasterSheet overlay.

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  useAppointments,
  useMasters,
  useTeams,
} from "@/app/dashboard/layout";
import {
  ACCOUNT_STATUS_LABELS,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  SALARY_MODEL_LABELS,
  SALARY_UNIT,
  getInitials,
  getTeamLeadIds,
  mergePermissions,
  type MasterPermissions,
  type Team,
} from "@/lib/masters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterDetailPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { masters, upsertMaster, deleteMaster } = useMasters();
  const { teams, setTeams } = useTeams();
  const { appointments } = useAppointments();

  const master = masters.find((m) => m.id === id);

  // Teams this master is part of — union of primary team_id and every
  // brigade with them in lead_ids/helper_ids. Used for preview +
  // avatar tinting. Primary is preferred for the avatar colour.
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

  const primaryTeam = assignedTeams[0] ?? null;

  // ── Previews ────────────────────────────────────────────────────────
  const infoPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const parts: string[] = [];
    if (master.phone) parts.push(master.phone);
    else parts.push("телефон не указан");
    const contactBits: string[] = [];
    if (master.whatsapp) contactBits.push("WhatsApp");
    if (master.telegram) contactBits.push("Telegram");
    if (master.email) contactBits.push("email");
    if (contactBits.length > 0) parts.push(contactBits.join(", "));
    if (master.credentials_set && master.account_status) {
      parts.push(ACCOUNT_STATUS_LABELS[master.account_status].toLowerCase());
    }
    return {
      text: parts.join(" · "),
      warning: !master.phone,
    };
  }, [master]);

  const employmentPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const role = ROLE_LABELS[master.role];
    const titleBit = master.title ? ` · ${master.title}` : "";
    if (assignedTeams.length === 0) {
      return { text: `${role} · без бригады`, warning: true };
    }
    if (assignedTeams.length === 1) {
      return { text: `${role}${titleBit} · ${assignedTeams[0].name}`, warning: false };
    }
    return {
      text: `${role}${titleBit} · ${assignedTeams.length} бригады`,
      warning: false,
    };
  }, [master, assignedTeams]);

  const salaryPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const s = master.salary;
    if (!s) return { text: "не настроена", warning: true };
    const model = SALARY_MODEL_LABELS[s.model];
    if (s.model === "percent_of_team" || s.model === "none") {
      return { text: model, warning: false };
    }
    const unit = SALARY_UNIT[s.model];
    const valueBit = s.value ? ` · ${s.value}${unit}` : "";
    return { text: `${model}${valueBit}`, warning: false };
  }, [master]);

  const accessPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const merged: MasterPermissions = mergePermissions(master.role, master.permissions);
    let on = 0;
    let total = 0;
    for (const g of PERMISSION_GROUPS) {
      for (const p of g.permissions) {
        total += 1;
        if (merged[p as keyof MasterPermissions]) on += 1;
      }
    }
    return { text: `${on} из ${total} включено`, warning: false };
  }, [master]);

  // Performance — count / revenue for appointments inside this
  // master's assigned brigades, current calendar month. Computed on
  // the fly from the `appointments` context so it is always fresh
  // (no cache to invalidate).
  const performance = useMemo(() => {
    if (!master || assignedTeams.length === 0) {
      return { total: 0, completed: 0, cancelled: 0, revenue: 0 };
    }
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const teamIds = new Set(assignedTeams.map((t) => t.id));
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let revenue = 0;
    for (const a of appointments) {
      if (!a.team_id || !teamIds.has(a.team_id)) continue;
      if (!a.date.startsWith(ym)) continue;
      total += 1;
      if (a.status === "completed") {
        completed += 1;
        revenue += a.total_amount ?? 0;
      } else if (a.status === "cancelled") {
        cancelled += 1;
      }
    }
    return { total, completed, cancelled, revenue };
  }, [master, assignedTeams, appointments]);

  const notesPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const n = master.notes?.trim();
    if (!n) return { text: "нет заметок", warning: false };
    const clipped = n.length > 80 ? `${n.slice(0, 77)}…` : n;
    return { text: clipped.replace(/\s+/g, " "), warning: false };
  }, [master]);

  if (!master) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center bg-[var(--surface-grouped)]">
        <div>
          <div className="text-[17px] font-semibold text-[var(--label)] mb-2">
            Сотрудник не найден
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/masters")}
            className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            К списку сотрудников
          </button>
        </div>
      </div>
    );
  }

  const tile = primaryTeam?.color ?? "#8E8E93";

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Удалить сотрудника «${master.full_name}»?`,
      message: "Будет удалён из всех бригад где состоял. Отменить нельзя.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
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
        nextHelperIds = t.helper_ids.filter((mid) => mid !== master.id);
        changed = true;
      }
      return changed
        ? { ...t, lead_id: nextLeadId, helper_ids: nextHelperIds }
        : t;
    });
    setTeams(updatedTeams);
    router.push("/dashboard/masters");
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
        <button
          type="button"
          onClick={() => router.push("/dashboard/masters")}
          aria-label="Назад"
          className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[11px] shrink-0"
            style={{ backgroundColor: tile }}
          >
            {getInitials(master.full_name)}
          </span>
          <span className="truncate">{master.full_name || "Сотрудник"}</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-6">
          <ListGroup>
            <NavRow
              icon={<Info size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-blue)]"
              title="Информация"
              value={infoPreview.text}
              warning={infoPreview.warning}
              onClick={() => router.push(`/dashboard/masters/${master.id}/info`)}
            />
            <NavRow
              icon={<Briefcase size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-indigo)]"
              title="Трудоустройство"
              value={employmentPreview.text}
              warning={employmentPreview.warning}
              onClick={() =>
                router.push(`/dashboard/masters/${master.id}/employment`)
              }
            />
            <NavRow
              icon={<Wallet size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-yellow)]"
              title="Зарплата"
              value={salaryPreview.text}
              warning={salaryPreview.warning}
              onClick={() => router.push(`/dashboard/masters/${master.id}/salary`)}
            />
            <NavRow
              icon={<ShieldCheck size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-red)]"
              title="Доступы"
              value={accessPreview.text}
              warning={accessPreview.warning}
              onClick={() => router.push(`/dashboard/masters/${master.id}/access`)}
            />
            <NavRow
              icon={<FileText size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-mint)]"
              title="Заметки"
              value={notesPreview.text}
              warning={notesPreview.warning}
              onClick={() => router.push(`/dashboard/masters/${master.id}/notes`)}
            />
          </ListGroup>

          <ListGroup>
            <div className="flex items-center gap-3 px-4 min-h-[56px]">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">
                  Сотрудник активен
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
                  {master.is_active
                    ? "Виден в календаре и выборе бригады."
                    : "В архиве — можно вернуть в любой момент."}
                </div>
              </div>
              <IOSSwitch
                checked={master.is_active}
                onChange={(next) => {
                  haptic("tap");
                  upsertMaster({ ...master, is_active: next });
                }}
                ariaLabel="Активен"
              />
            </div>
          </ListGroup>

          {/* Мини-сводка за текущий месяц — считается из визитов в
              бригадах, где участвует мастер. Не отображается если
              нет ни одной бригады. */}
          {assignedTeams.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-secondary)] mb-2">
                За этот месяц
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PerfTile
                  label="Визитов"
                  value={String(performance.total)}
                />
                <PerfTile
                  label="Закрыто"
                  value={String(performance.completed)}
                />
                <PerfTile
                  label="Выручка"
                  value={`${Math.round(performance.revenue)} €`}
                />
              </div>
              <div className="mt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
                Считается по всем бригадам, где участвует сотрудник.
                {performance.cancelled > 0 && (
                  <> Отменённых: {performance.cancelled}.</>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--system-red)] text-[15px] font-medium press-scale active:bg-[rgba(255,59,48,0.08)] shadow-[var(--shadow-card)]"
          >
            <Trash2 size={16} strokeWidth={2} />
            Удалить сотрудника
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────

function PerfTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[var(--fill-tertiary)] px-2 py-2">
      <div className="text-[18px] font-semibold text-[var(--label)] tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[11px] text-[var(--label-tertiary)] uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}

function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
      {children}
    </div>
  );
}

function NavRow({
  icon,
  tone,
  title,
  value,
  warning,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  value: string;
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-[var(--fill-quaternary)] transition press-scale"
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${tone}`}
      >
        {icon}
      </span>
      <span className="flex-1 text-left min-w-0">
        <span className="block text-[15px] font-medium text-[var(--label)] truncate">
          {title}
        </span>
        {value && (
          <span
            className={`text-[13px] truncate mt-0.5 flex items-center gap-1 ${
              warning
                ? "text-[color:var(--system-yellow-strong,#B78600)] font-medium"
                : "text-[var(--label-secondary)]"
            }`}
          >
            {warning && (
              <AlertTriangle
                size={12}
                strokeWidth={2.5}
                className="shrink-0 text-[var(--system-yellow)] fill-[var(--system-yellow)]"
              />
            )}
            <span className="truncate">{value}</span>
          </span>
        )}
      </span>
      <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
    </button>
  );
}
