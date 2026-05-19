"use client";

// Sprint 033 Phase I32 — /dashboard/masters/[id] detail hub.
//
// Each row has its own iOS-style subroute:
//   /info          — identity + contacts + Babun account + bank (mega)
//   /access        — permissions matrix
//   /schedule      — this master's appointments filtered from calendar
//   /stats         — performance drill-down
//
// Brigade membership lives here on the hub as read-only plashki
// (edits on the brigade side). /employment, /notes and /salary
// subroutes were removed — brigades + hire date + notes were either
// unused or shown inline; salary is moving to the Finances module.

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  MoreVertical,
  ShieldCheck,
  Trash2,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ContextMenu, { type ContextMenuOption } from "@/components/ui/ContextMenu";
import IOSSwitch from "@/components/ui/IOSSwitch";
import MasterContactMenu from "@/components/masters/MasterContactMenu";
import { safeBack } from "@/lib/nav/safe-back";
import { isAvatarSet } from "@babun/shared/local/selectors/avatars";
import {
  useAppointments,
  useMasters,
  useTeams,
} from "@/components/layout/DashboardClientLayout";
import {
  ACCOUNT_STATUS_LABELS,
  PERMISSION_GROUPS,
  getInitials,
  getTeamLeadIds,
  mergePermissions,
  type MasterPermissions,
  type Team,
} from "@babun/shared/local/masters";

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

  const [contactOpen, setContactOpen] = useState(false);
  // P2 #44 (CRM Core brief) — header kebab replaces the bottom
  // «Удалить мастера» button. Tap anchors a Telegram-style
  // context menu with Архивировать / Удалить (red).
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

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


  if (!master) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center bg-[var(--surface-grouped)]">
        <div>
          <div className="text-[17px] font-semibold text-[var(--label)] mb-2">
            Мастер не найден
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/masters")}
            className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            К списку мастеров
          </button>
        </div>
      </div>
    );
  }

  const tile = primaryTeam?.color ?? "#8E8E93";

  // Lifetime appointment count through master's teams. Used to show
  // dependency weight in the destructive-action confirm — operators
  // routinely forget how much history a master has accumulated.
  const linkedAppointmentCount = (() => {
    if (assignedTeams.length === 0) return 0;
    const teamIds = new Set(assignedTeams.map((t) => t.id));
    return appointments.filter((a) => a.team_id != null && teamIds.has(a.team_id)).length;
  })();

  const handleToggleArchive = () => {
    haptic("tap");
    upsertMaster({ ...master, is_active: !master.is_active });
  };

  const handleDelete = async () => {
    const teamPart = assignedTeams.length > 0
      ? `${assignedTeams.length} ${pluralTeamsRu(assignedTeams.length)}`
      : null;
    const apptPart = linkedAppointmentCount > 0
      ? `${linkedAppointmentCount} ${pluralVisits(linkedAppointmentCount)}`
      : null;
    const depParts = [apptPart, teamPart].filter(Boolean).join(" · ");
    const message = depParts
      ? `Связан с: ${depParts}. Отменить нельзя.`
      : "Будет удалён. Отменить нельзя.";
    const ok = await confirm({
      title: `Удалить мастера «${master.full_name}»?`,
      message,
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

  const menuOptions: ContextMenuOption[] = [
    {
      label: master.is_active ? "Архивировать" : "Вернуть из архива",
      icon: master.is_active ? (
        <Archive size={18} strokeWidth={2} />
      ) : (
        <ArchiveRestore size={18} strokeWidth={2} />
      ),
      onSelect: handleToggleArchive,
    },
    {
      label: "Удалить",
      icon: <Trash2 size={18} strokeWidth={2} />,
      danger: true,
      onSelect: () => {
        void handleDelete();
      },
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
        <button
          type="button"
          onClick={() => safeBack(router, "/dashboard/masters")}
          aria-label="Назад"
          className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[11px] shrink-0"
            style={{ backgroundColor: master.avatar_url ? "transparent" : tile }}
          >
            {master.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={master.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(master.full_name)
            )}
          </span>
          <span className="truncate">{master.full_name || "Мастер"}</span>
        </h1>
        {/* P2 #44 (CRM Core brief) — kebab in the header is the new
            home for archive + destructive actions. Replaces the
            bottom «Удалить мастера» button (a primary surface for
            a rare, destructive action). */}
        <button
          type="button"
          onClick={(e) => {
            haptic("tap");
            setMenuAnchor({ x: e.clientX, y: e.clientY });
          }}
          aria-label="Действия"
          className="ml-auto w-11 h-11 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <MoreVertical size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-5">
          {/* Profile card — big avatar + name + title. Avatar is a
              tap target that opens the quick-contact menu
              (call / WhatsApp / Telegram / внутренний чат). */}
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setContactOpen(true);
              }}
              aria-label="Связаться"
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[22px] active:scale-[0.97] transition"
              style={{ backgroundColor: isAvatarSet(master.avatar_url) ? "transparent" : tile }}
            >
              {isAvatarSet(master.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={master.avatar_url!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(master.full_name)
              )}
            </button>
            <div className="text-[17px] font-semibold text-[var(--label)] text-center tracking-tight leading-tight">
              {master.full_name || "Мастер"}
            </div>
            {master.title && (
              <div className="text-[13px] text-[var(--label-secondary)] text-center -mt-1.5">
                {master.title}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setContactOpen(true);
              }}
              className="mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] font-semibold active:scale-[0.97]"
            >
              Связаться
            </button>
          </div>

          {/* Brigade membership — read-only plashki. Tap opens the
              brigade hub. Edit flow lives on the brigade side
              («Команда» → добавить участника). */}
          {assignedTeams.length > 0 && (
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
                В командах
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      haptic("tap");
                      router.push(`/dashboard/teams/${team.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--surface-card)] shadow-[var(--shadow-card)] text-[13px] font-semibold text-[var(--label)] active:scale-[0.97] transition"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: team.color }}
                    />
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hire date summary — one-liner. Edited on /info alongside
              День рождения; shown here as read-only context. */}
          {master.hire_date && (
            <div className="px-1 text-[12px] text-[var(--label-secondary)]">
              Работает с {formatHireDate(master.hire_date)}
              {(() => {
                const t = formatTenure(master.hire_date);
                return t ? ` · ${t}` : "";
              })()}
            </div>
          )}

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
              icon={<ShieldCheck size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-red)]"
              title="Доступы"
              value={accessPreview.text}
              warning={accessPreview.warning}
              onClick={() => router.push(`/dashboard/masters/${master.id}/access`)}
            />
            <NavRow
              icon={<CalendarDays size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-indigo)]"
              // STORY audit: было «Расписание» — но страница показывает
              // СПИСОК визитов мастера, а не weekly grid. «Расписание»
              // как термин уже занят на /teams/[id]/schedule (грид
              // рабочих часов бригады), и совпадение слов путало. Новое
              // имя «Визиты» совпадает с содержимым.
              title="Визиты"
              value={
                performance.total > 0
                  ? `${performance.total} ${pluralVisits(performance.total)} в этом месяце`
                  : "нет визитов в этом месяце"
              }
              onClick={() => router.push(`/dashboard/masters/${master.id}/schedule`)}
            />
            <NavRow
              icon={<BarChart3 size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-mint)]"
              title="Статистика"
              value={
                performance.completed > 0
                  ? `${performance.completed} закрыто · ${Math.round(performance.revenue)} €`
                  : "пока без данных"
              }
              onClick={() => router.push(`/dashboard/masters/${master.id}/stats`)}
            />
          </ListGroup>

          <ListGroup>
            <div className="flex items-center gap-3 px-4 min-h-[56px]">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">
                  Мастер активен
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
                  {master.is_active
                    ? "Виден в календаре и выборе команды."
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
              командах, где участвует мастер. Тап по карточке уводит
              на полный экран «Статистика». */}
          {assignedTeams.length > 0 && (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                router.push(`/dashboard/masters/${master.id}/stats`);
              }}
              className="w-full text-left bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3 active:scale-[0.995] active:bg-[var(--fill-quaternary)] transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-secondary)]">
                  За этот месяц
                </div>
                <span className="text-[12px] text-[var(--accent)] font-semibold inline-flex items-center gap-0.5">
                  Подробнее
                  <ChevronRight size={14} strokeWidth={2.5} />
                </span>
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
                Считается по всем командам, где участвует сотрудник.
                {performance.cancelled > 0 && (
                  <> Отменённых: {performance.cancelled}.</>
                )}
              </div>
            </button>
          )}

          {/* P2 #44 — bottom «Удалить мастера» moved to header kebab. */}
        </div>
      </div>

      <ContextMenu
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchor={menuAnchor}
        title={master.full_name || "Мастер"}
        options={menuOptions}
      />

      <MasterContactMenu
        open={contactOpen}
        master={master}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}

function pluralVisits(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "визит";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "визита";
  return "визитов";
}

function pluralTeamsRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "команда";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "команды";
  return "команд";
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

function formatHireDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTenure(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return null;
  if (months < 12) return `${months} мес.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} ${plural(years, "год", "года", "лет")}`
    : `${years} ${plural(years, "год", "года", "лет")} ${rem} мес.`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
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
