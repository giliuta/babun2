"use client";

// Sprint 033 Phase I31 — /dashboard/masters/[id] detail hub.
//
// Mirrors /dashboard/teams/[id]: the detail page is a compact list of
// nav rows (one per section) instead of one long accordion. Each row
// jumps to a full-page editor.
//
// Subroutes on disk today:
//   /dashboard/masters/:id/info   — name · role · phone · email · birthday
//   /dashboard/masters/:id/notes  — freeform notes
//
// Remaining 4 rows (Контакты / Бригада / ЗП / Доступы) don't have their
// own subroute files yet — they open the legacy MasterSheet overlay
// locally on this page as a bridge until each one gets its own editor.

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Phone,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  ACCOUNT_STATUS_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  SALARY_MODEL_LABELS,
  SALARY_UNIT,
  getInitials,
  mergePermissions,
  type Master,
  type MasterPermissions,
  type Team,
} from "@/lib/masters";
import MasterSheet from "../MasterSheet";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type SheetSection = "contacts" | "job" | "salary" | "permissions";

export default function MasterDetailPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { masters, upsertMaster, deleteMaster } = useMasters();
  const { teams, setTeams } = useTeams();

  const master = masters.find((m) => m.id === id);
  // Opened when one of the not-yet-extracted rows is tapped.
  const [sheetOpen, setSheetOpen] = useState<SheetSection | null>(null);

  const team = useMemo<Team | null>(() => {
    if (!master?.team_id) return null;
    return teams.find((t) => t.id === master.team_id) ?? null;
  }, [master, teams]);

  // ── Previews ────────────────────────────────────────────────────────
  const infoPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const role = ROLE_LABELS[master.role];
    const parts = [role];
    if (!master.is_active) parts.push("архив");
    return { text: parts.join(" · "), warning: false };
  }, [master]);

  const contactsPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    if (!master.phone) return { text: "телефон не указан", warning: true };
    const extra: string[] = [];
    if (master.email) extra.push("email");
    if (master.whatsapp) extra.push("WhatsApp");
    if (master.telegram) extra.push("Telegram");
    const suffix = extra.length > 0 ? ` · ${extra.join(", ")}` : "";
    return { text: `${master.phone}${suffix}`, warning: false };
  }, [master]);

  const teamPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    if (!team) return { text: "не закреплён", warning: true };
    return { text: team.name, warning: false };
  }, [master, team]);

  const salaryPreview = useMemo((): { text: string; warning: boolean } => {
    if (!master) return { text: "", warning: false };
    const s = master.salary;
    if (!s) return { text: "не настроена", warning: true };
    const model = SALARY_MODEL_LABELS[s.model];
    if (s.model === "percent_of_team") return { text: model, warning: false };
    if (s.model === "none") return { text: model, warning: false };
    const unit = SALARY_UNIT[s.model];
    const valueBit = s.value ? ` · ${s.value}${unit}` : "";
    return { text: `${model}${valueBit}`, warning: false };
  }, [master]);

  const permissionsPreview = useMemo((): { text: string; warning: boolean } => {
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
    void PERMISSION_LABELS;
    return { text: `${on} из ${total} включено`, warning: false };
  }, [master]);

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

  const tile = team?.color ?? "#8E8E93";
  const statusLabel = master.account_status
    ? ACCOUNT_STATUS_LABELS[master.account_status]
    : null;

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
      {/* iOS-style flat nav bar */}
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
              icon={<Phone size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-green)]"
              title="Контакты"
              value={contactsPreview.text}
              warning={contactsPreview.warning}
              onClick={() => setSheetOpen("contacts")}
            />
            <NavRow
              icon={<Briefcase size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-indigo)]"
              title="Бригада и роль"
              value={teamPreview.text}
              warning={teamPreview.warning}
              onClick={() => setSheetOpen("job")}
            />
            <NavRow
              icon={<Wallet size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-yellow)]"
              title="Зарплата"
              value={salaryPreview.text}
              warning={salaryPreview.warning}
              onClick={() => setSheetOpen("salary")}
            />
            <NavRow
              icon={<ShieldCheck size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-red)]"
              title="Доступы"
              value={permissionsPreview.text}
              warning={permissionsPreview.warning}
              onClick={() => setSheetOpen("permissions")}
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

          {/* Status toggle — flips is_active inline. Mirrors brigade detail. */}
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

          {statusLabel && (
            <div className="px-4 text-[12px] text-[var(--label-tertiary)]">
              Учётная запись:{" "}
              <span className="text-[var(--label-secondary)] font-medium">
                {statusLabel}
              </span>
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

      {sheetOpen && (
        <MasterSheet
          key={master.id}
          master={master}
          teams={teams}
          onCancel={() => setSheetOpen(null)}
          onSave={(next) => {
            upsertMaster(next);
            setSheetOpen(null);
          }}
          onDelete={() => {
            setSheetOpen(null);
            void handleDelete();
          }}
        />
      )}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────

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
