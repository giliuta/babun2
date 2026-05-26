"use client";

// Sprint 033 Phase H — Telegram-style brigade page.
//
// Previous layout stuffed 7 sections into one scrollable card. User
// feedback (screenshot): "сверни всё, как в Telegram — нажал на
// услуги — попал на отдельную страницу". Now the brigade page is a
// compact list of nav rows. Each row goes to its own subroute with a
// full-page editor for that section.
//
// Subroutes:
//   /dashboard/teams/:id/info      — name · description · colour · status
//   /dashboard/teams/:id/cities    — cities / filials / tags
//   /dashboard/teams/:id/masters   — leads + helpers
//   /dashboard/teams/:id/services  — brigade services
//   /dashboard/teams/:id/calendar  — grid window + scroll-to
//   /dashboard/teams/:id/schedule  — work hours + break + days off

import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  Info,
  Package,
  Trash2,
  Users as UsersIcon,
  Wrench,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { safeBack } from "@/lib/nav/safe-back";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { ListGroup, NavRow } from "@/components/teams/BrigadeNavRow";
import {
  useMasters,
  useTeams,
  useServices,
  useAppointments,
  useCities,
  useEquipment,
} from "@/components/layout/DashboardClientLayout";
import {
  getTeamLeadIds,
  type Master,
  type Team,
} from "@babun/shared/local/masters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeIndexPage({ params }: RouteParams) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const confirm = useConfirm();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const { services } = useServices();
  const { appointments, upsertAppointment } = useAppointments();
  const { cities } = useCities();
  const { equipment } = useEquipment();

  // BUGFIX (bug-hunt sweep) — `if (isNew) early-return` was here,
  // but the eight `useMemo` hooks below it ran conditionally
  // (skipped when isNew=true), violating rules-of-hooks. The early
  // return is now moved AFTER all hooks. The redirect is dispatched
  // in a useEffect so it runs after React's first paint of the
  // (empty) page; the visual flash is the same as before since the
  // page renders nothing (team is undefined, all previews are "").
  const team = teams.find((t) => t.id === id);

  // ── Compose preview strings for each row ────────────────────────────
  const infoPreview = useMemo(() => {
    if (!team) return "";
    const parts = [team.name];
    if (!team.active) parts.push("архив");
    return parts.filter(Boolean).join(" · ");
  }, [team]);

  // Previews now also return a `warning` flag so the row can tint its
  // subtitle yellow + show a ⚠ icon when the subsection isn't set up.
  // Consistent with the brigades-list row treatment.
  const mastersPreview = useMemo((): { text: string; warning: boolean } => {
    if (!team) return { text: "", warning: false };
    // Phase I43 — prefer new `members` shape when defined; fall back
    // to legacy lead/helper split otherwise.
    const memberCount = team.members
      ? team.members.length
      : getTeamLeadIds(team).length + (team.helper_ids?.length ?? 0);
    if (memberCount === 0) {
      return { text: "нет участников", warning: true };
    }
    // Show first two names, then "и ещё N".
    const ids = team.members
      ? team.members.map((m) => m.master_id)
      : [...getTeamLeadIds(team), ...(team.helper_ids ?? [])];
    const names = ids
      .map((mid) => masters.find((m) => m.id === mid)?.full_name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) {
      return { text: "нет участников", warning: true };
    }
    if (names.length === 1) return { text: names[0], warning: false };
    if (names.length === 2) {
      return { text: `${names[0]} · ${names[1]}`, warning: false };
    }
    return {
      text: `${names[0]} и ещё ${names.length - 1}`,
      warning: false,
    };
  }, [team, masters]);

  const servicesPreview = useMemo((): { text: string; warning: boolean } => {
    if (!team) return { text: "", warning: false };
    const count = services.filter(
      (s) => s.is_active !== false && s.brigade_ids.includes(team.id),
    ).length;
    if (count === 0)
      // Intentionally NOT a warning — zero-services reads as "доступны все"
      // which is a valid brigade setup.
      return { text: "не заданы — доступны все", warning: false };
    return { text: `${count} ${serviceWord(count)}`, warning: false };
  }, [team, services]);

  const equipmentPreview = useMemo((): { text: string; warning: boolean } => {
    if (!team) return { text: "", warning: false };
    const count = equipment.filter(
      (e) => e.is_active !== false && e.assigned_team_id === team.id,
    ).length;
    if (count === 0) return { text: "не закреплено", warning: false };
    return { text: `${count} ${equipmentWord(count)}`, warning: false };
  }, [team, equipment]);

  const calendarPreview = useMemo(() => {
    if (!team) return "";
    const start = team.calendar_window_start;
    const end = team.calendar_window_end;
    const scroll = team.default_scroll_time;
    if (!start && !end && !scroll) return "как в общих настройках";
    const window = start && end ? `${start}–${end}` : "";
    const scrollBit = scroll ? ` · откр. на ${scroll}` : "";
    return `${window || "24 ч"}${scrollBit}`;
  }, [team]);

  const activeCities = cities.filter((c) => c.isActive);
  void activeCities;

  // BUGFIX (bug-hunt sweep) — redirect for the `id === "new"` case
  // moved into a useEffect so it runs after the hooks above. Was
  // previously a synchronous `if (isNew) router.replace(...) ; return null`
  // block at the top of the component, which made every useMemo
  // below it conditional and tripped rules-of-hooks. The page
  // renders nothing-visible during the redirect (team is undefined,
  // hits the not-found branch — same UX as before).
  useEffect(() => {
    if (isNew) router.replace("/dashboard/teams/new/info");
  }, [isNew, router]);

  // ── Guard for unknown id ────────────────────────────────────────────
  // For isNew we render an empty placeholder (no "Не найдена" flash)
  // while the redirect-effect kicks in.
  if (isNew) {
    return (
      <div className="flex-1 bg-[var(--surface-grouped)]" aria-hidden />
    );
  }
  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center bg-[var(--surface-grouped)]">
        <div>
          <div className="text-[17px] font-semibold text-[var(--label)] mb-2">
            Команда не найдена
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/teams")}
            className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            К списку команд
          </button>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    const orphanCount = appointments.filter((a) => a.team_id === team.id).length;
    const ok = await confirm({
      title: `Удалить команду «${team.name}»?`,
      message:
        orphanCount > 0
          ? `У ${orphanCount} записей сбросится привязка к команде (team_id будет пустым).`
          : "Эта команда нигде не используется.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("tap");
    deleteTeam(team.id);
    const updatedMasters = masters.map<Master>((m) =>
      m.team_id === team.id ? { ...m, team_id: null } : m,
    );
    setMasters(updatedMasters);
    for (const apt of appointments) {
      if (apt.team_id === team.id) {
        upsertAppointment({ ...apt, team_id: null, updated_at: new Date().toISOString() });
      }
    }
    router.push("/dashboard/teams");
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      {/* iOS-style flat nav bar with team name + colour dot */}
      <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
        <button
          type="button"
          onClick={() => safeBack(router, "/dashboard/teams")}
          aria-label="Назад"
          className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: team.color }}
          />
          {team.name || "Команда"}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-6">
          {/* Main brigade sections as nav rows */}
          <ListGroup>
            <NavRow
              icon={<Info size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-blue)]"
              title="Информация"
              value={infoPreview}
              onClick={() => router.push(`/dashboard/teams/${team.id}/info`)}
            />
            <NavRow
              icon={<UsersIcon size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-indigo)]"
              // STORY audit: было «Команда», заголовок целевой страницы
              // — «Сотрудники», а в иерархии sidebar — «Мастера». Три
              // термина → путаница. Унифицируем как «Мастера».
              title="Мастера"
              value={mastersPreview.text}
              warning={mastersPreview.warning}
              onClick={() => router.push(`/dashboard/teams/${team.id}/masters`)}
            />
            <NavRow
              icon={<Wrench size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-purple)]"
              title="Услуги"
              value={servicesPreview.text}
              warning={servicesPreview.warning}
              onClick={() => router.push(`/dashboard/teams/${team.id}/services`)}
            />
            <NavRow
              icon={<Package size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-mint)]"
              title="Оборудование"
              value={equipmentPreview.text}
              warning={equipmentPreview.warning}
              onClick={() => router.push(`/dashboard/teams/${team.id}/equipment`)}
            />
          </ListGroup>

          <ListGroup>
            <NavRow
              icon={<CalendarDays size={18} strokeWidth={2} />}
              tone="bg-[var(--tile-orange)]"
              title="Календарь"
              value={calendarPreview}
              onClick={() => router.push(`/dashboard/teams/${team.id}/calendar`)}
            />
          </ListGroup>

          {/* Status toggle — lives inline so one tap flips active/archive
              without leaving this page. */}
          <ListGroup>
            <div className="flex items-center gap-3 px-4 min-h-[56px]">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">
                  Команда активна
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
                  {team.active
                    ? "Показывается в списках, календаре и выборе."
                    : "Скрыта — можно вернуть из архива в любой момент."}
                </div>
              </div>
              <IOSSwitch
                checked={team.active !== false}
                onChange={(next) => {
                  haptic("tap");
                  upsertTeam({ ...team, active: next });
                }}
                ariaLabel="Активна"
              />
            </div>
          </ListGroup>

          {/* Destructive */}
          <button
            type="button"
            onClick={handleDelete}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--system-red)] text-[15px] font-medium press-scale active:bg-[rgba(255,59,48,0.08)] shadow-[var(--shadow-card)]"
          >
            <Trash2 size={16} strokeWidth={2} />
            Удалить команду
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small utilities ──────────────────────────────────────────────────

// helperWord removed in Phase I43 — mastersPreview no longer splits
// leads / helpers since members live in a single list with custom
// roles now.

function serviceWord(n: number): string {
  if (n === 1) return "услуга";
  if (n >= 2 && n <= 4) return "услуги";
  return "услуг";
}

function equipmentWord(n: number): string {
  if (n === 1) return "предмет";
  if (n >= 2 && n <= 4) return "предмета";
  return "предметов";
}

// Re-exported for subroute pages so they can import the same type.
export type { Team };
