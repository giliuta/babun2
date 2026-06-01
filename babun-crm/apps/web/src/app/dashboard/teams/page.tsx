"use client";

// Sprint 033 Phase I13 — Brigades list redesign.
//
// Goals (from iPhone walkthrough):
//  · Shrink each card. Previously every brigade took ~half a screen;
//    now it's a 64-px row inside a shared iOS-style card.
//  · Kill inline edit (pencil) + delete (trash) icons. They were
//    loud AND dangerous: one wrong tap on the red trash deleted a
//    brigade and cascaded to appointments. Now: tap = open detail,
//    swipe-left = red Удалить (with confirm), long-press = menu.
//  · Subtitle summarises: lead name · cities. Missing info reads as
//    a single short line ("Нужно настроить"), not two ghost rows.
//  · Inactive/archived brigades dim inline; no separate section yet
//    (add it when a tenant has >3 archives).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useIsDesktop } from "@/lib/useIsDesktop";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  Users,
} from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import EmptyState from "@/components/ui/EmptyState";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
import { haptic } from "@/lib/haptics";
import {
  useAppointments,
  useMasters,
  useSchedules,
  useTeams,
} from "@/components/layout/DashboardClientLayout";
import {
  generateId,
  getTeamMembers,
  TEAM_COLORS,
  type Master,
  type Team,
} from "@babun/shared/local/masters";

export default function TeamsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const { appointments, upsertAppointment } = useAppointments();
  const { schedules, setSchedules } = useSchedules();
  const confirm = useConfirm();

  const [menu, setMenu] = useState<{
    team: Team;
    anchor: { x: number; y: number };
  } | null>(null);

  // Active first, archived last. Within each bucket sort by
  // sort_order asc (records without a value sink to the end).
  const sortedTeams = useMemo(() => {
    return teams.slice().sort((a, b) => {
      const aActive = a.active !== false ? 0 : 1;
      const bActive = b.active !== false ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aOrd = a.sort_order ?? Number.POSITIVE_INFINITY;
      const bOrd = b.sort_order ?? Number.POSITIVE_INFINITY;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
  }, [teams]);

  // DnD — activate drag after 500 ms hold with <6 px movement, so
  // taps and horizontal swipes still belong to SwipeableRow.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 500, tolerance: 6 },
    }),
  );

  // Inline-create — no separate «Информация» form anymore. Make a blank
  // team and jump straight to its calendar settings, where name + colour
  // are edited inline at the top.
  const openNew = () => {
    haptic("tap");
    const team: Team = {
      id: generateId("team"),
      name: "Новая команда",
      region: "",
      color: TEAM_COLORS[0].value,
      default_city: "",
      lead_id: null,
      helper_ids: [],
      payout_percentage: 30,
      active: true,
      created_at: new Date().toISOString(),
      // Creation defaults (editable afterwards): visible 00:00–23:00,
      // open-at 10:00. Working hours (10:00–20:00) live on the schedule.
      calendar_window_start: "00:00",
      calendar_window_end: "23:00",
      default_scroll_time: "10:00",
    };
    upsertTeam(team);
    setSchedules({
      ...schedules,
      [team.id]: { start: "10:00", end: "20:00", breaks: [] },
    });
    router.push(`/dashboard/teams/${team.id}/calendar`);
  };

  // One-tap create from the calendar's «Создать календарь» empty state.
  // /dashboard/teams?new=1 lands here and immediately spins up a fresh
  // team + its calendar settings.
  //
  // v797 — the in-component ref does NOT survive a remount, so a BACK
  // navigation to /dashboard/teams?new=1 (which Next remounts) used to
  // re-fire openNew() and spawn duplicate teams. We now strip ?new=1 from
  // this history entry the instant we handle it, so there's nothing to
  // re-trigger on BACK. openNew() then pushes the new calendar on top.
  const autoNewHandledRef = useRef(false);
  useEffect(() => {
    if (autoNewHandledRef.current) return;
    if (searchParams?.get("new") === "1") {
      autoNewHandledRef.current = true;
      router.replace("/dashboard/teams");
      openNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openTeam = (team: Team) => router.push(`/dashboard/teams/${team.id}`);
  const openCalendarForTeam = (team: Team) => {
    // /dashboard reads the `?team=<id>` param and hydrates
    // activeTeamId from it on first render.
    router.push(`/dashboard?team=${encodeURIComponent(team.id)}`);
  };

  const toggleArchived = (team: Team) => {
    haptic("tap");
    upsertTeam({ ...team, active: team.active === false });
  };

  const duplicateTeam = (team: Team) => {
    haptic("tap");
    upsertTeam({
      ...team,
      id: generateId("team"),
      name: `${team.name} (копия)`,
      sort_order: undefined, // land at the end
      created_at: new Date().toISOString(),
    });
  };

  // Drop handler — reorders sortedTeams (within the active or
  // archived bucket) and persists sort_order in steps of 10.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic("tap");
    const activeTeam = teams.find((t) => t.id === active.id);
    if (!activeTeam) return;
    const bucket = sortedTeams.filter(
      (t) => (t.active !== false) === (activeTeam.active !== false),
    );
    const oldIdx = bucket.findIndex((t) => t.id === active.id);
    const newIdx = bucket.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(bucket, oldIdx, newIdx);
    reordered.forEach((t, i) => {
      const next = (i + 1) * 10;
      if (t.sort_order !== next) upsertTeam({ ...t, sort_order: next });
    });
  };

  const handleDelete = async (team: Team) => {
    const orphanCount = appointments.filter(
      (a) => a.team_id === team.id,
    ).length;
    const extra =
      orphanCount > 0
        ? `У ${orphanCount} записей сбросится привязка к команде (сами записи останутся).`
        : "Эта команда нигде не используется.";
    const ok = await confirm({
      title: `Удалить команду «${team.name}»?`,
      message: extra,
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    deleteTeam(team.id);
    // Clear team_id on any master that was in this team.
    setMasters(
      masters.map<Master>((m) =>
        m.team_id === team.id ? { ...m, team_id: null } : m,
      ),
    );
    // Cascade to appointments so the calendar doesn't show orphans.
    for (const apt of appointments) {
      if (apt.team_id === team.id) {
        upsertAppointment({
          ...apt,
          team_id: null,
          updated_at: new Date().toISOString(),
        });
      }
    }
  };

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Открыть",
          icon: <ChevronRight size={18} strokeWidth={2} />,
          onSelect: () => openTeam(menu.team),
        },
        {
          label: "Открыть календарь",
          icon: <CalendarDays size={18} strokeWidth={2} />,
          onSelect: () => openCalendarForTeam(menu.team),
        },
        {
          label: "Дублировать",
          icon: <Copy size={18} strokeWidth={2} />,
          onSelect: () => duplicateTeam(menu.team),
        },
        {
          label: menu.team.active === false ? "Вернуть из архива" : "В архив",
          icon:
            menu.team.active === false ? (
              <ArchiveRestore size={18} strokeWidth={2} />
            ) : (
              <Archive size={18} strokeWidth={2} />
            ),
          onSelect: () => toggleArchived(menu.team),
        },
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => handleDelete(menu.team),
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Команды" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-4">
          {teams.length === 0 ? (
            <EmptyState
              variant="prominent"
              icon={<Users size={28} strokeWidth={2} />}
              title="Пока нет ни одной команды"
              description="Команда — это группа мастеров, которая вместе работает и появляется на календаре своим цветом."
              action={
                <button
                  type="button"
                  onClick={openNew}
                  className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
                >
                  Создать команду
                </button>
              }
            />
          ) : (
            <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={sortedTeams.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedTeams.map((team) => (
                    <SortableBrigadeRow
                      key={team.id}
                      team={team}
                      masters={masters}
                      onTap={() => openTeam(team)}
                      onLongPress={(anchor) => setMenu({ team, anchor })}
                      onArchive={() => toggleArchived(team)}
                      onDelete={() => handleDelete(team)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <button
                type="button"
                onClick={openNew}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                  <Plus size={18} strokeWidth={2.5} />
                </span>
                <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                  Новая команда
                </span>
              </button>
            </div>
          )}

          {teams.length > 0 && <GestureHint />}
        </div>
      </div>

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.team.name}
        options={menuOptions}
      />
    </>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────

// STORY-059 — local EmptyState removed in favour of the shared
// component (variant="prominent"). Same accent-tinted disc + 16-px
// circle, so this is a straight refactor with no UX delta.

// ─── Sortable brigade row ──────────────────────────────────────────────

function SortableBrigadeRow({
  team,
  masters,
  onTap,
  onLongPress,
  onArchive,
  onDelete,
}: {
  team: Team;
  masters: Master[];
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
    boxShadow: isDragging
      ? "0 10px 24px rgba(0,0,0,0.18)"
      : undefined,
    background: isDragging ? "var(--surface-card)" : undefined,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SwipeableRow
        leftActions={[
          {
            label: team.active === false ? "Вернуть" : "В архив",
            color: "bg-[var(--system-yellow)]",
            icon:
              team.active === false ? (
                <ArchiveRestore size={16} strokeWidth={2} />
              ) : (
                <Archive size={16} strokeWidth={2} />
              ),
            onSelect: onArchive,
          },
        ]}
        rightActions={[
          {
            label: "Удалить",
            color: "bg-[var(--system-red)]",
            icon: <Trash2 size={16} strokeWidth={2} />,
            onSelect: onDelete,
          },
        ]}
      >
        <BrigadeRow
          team={team}
          masters={masters}
          onTap={onTap}
          onLongPress={onLongPress}
          dragListeners={listeners}
        />
      </SwipeableRow>
    </div>
  );
}

// ─── Brigade row ───────────────────────────────────────────────────────

function BrigadeRow({
  team,
  masters,
  onTap,
  onLongPress,
  dragListeners,
}: {
  team: Team;
  masters: Master[];
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  dragListeners?: Record<string, unknown>;
}) {
  const handlers = useLongPressOrTap({
    onTap,
    onLongPress,
    isInsideDragHandle: (t) =>
      !!(t as HTMLElement | null)?.closest?.("[data-drag-handle]"),
  });
  const { lead, helpers } = getTeamMembers(team, masters);
  const memberCount = (lead ? 1 : 0) + helpers.length;
  const archived = team.active === false;

  const { text: subtitle, needsSetup } = buildSubtitle({
    team,
    lead,
    memberCount,
  });

  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[64px] py-2 cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        archived ? "opacity-60" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className={`w-9 h-9 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[14px] shrink-0 ${
          archived ? "grayscale" : ""
        }`}
        style={{ backgroundColor: team.color }}
      >
        {team.name.charAt(0).toUpperCase() || "?"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-[var(--label)] truncate">
            {team.name}
          </span>
          {archived && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[var(--fill-tertiary)] text-[var(--label-secondary)] shrink-0">
              архив
            </span>
          )}
        </div>
        <div
          className={`text-[13px] truncate flex items-center gap-1 ${
            needsSetup
              ? "text-[color:var(--system-yellow-strong,#B78600)] font-medium"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {needsSetup && (
            <AlertTriangle
              size={12}
              strokeWidth={2.5}
              className="shrink-0 text-[var(--system-yellow)] fill-[var(--system-yellow)]"
            />
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      </div>
      {/* Drag handle — dnd-kit listeners live here only. The long-
          press hook bails out via isInsideDragHandle when the user
          grabs this element, so the two gestures don't fight. */}
      {dragListeners && (
        <span
          {...(dragListeners as Record<string, (e: React.PointerEvent) => void>)}
          data-drag-handle
          aria-label="Перетащить"
          className="shrink-0 w-10 h-10 flex items-center justify-center text-[var(--label-quaternary)] touch-none"
        >
          <GripVertical size={18} strokeWidth={2} />
        </span>
      )}
      <ChevronRight
        size={18}
        strokeWidth={2}
        className="text-[var(--label-quaternary)] shrink-0"
      />
    </div>
  );
}

// Subtitle composer — returns the display string + a flag so the
// row can tint itself yellow and show a warning icon when the
// brigade isn't fully set up.
function buildSubtitle({
  team,
  lead,
  memberCount,
}: {
  team: Team;
  lead: Master | null;
  memberCount: number;
}): { text: string; needsSetup: boolean } {
  const parts: string[] = [];
  if (lead) parts.push(lead.full_name);
  const cities = (team.cities ?? []).filter(Boolean);
  if (cities.length > 0) {
    if (cities.length <= 2) parts.push(cities.join(", "));
    else parts.push(`${cities.slice(0, 2).join(", ")} +${cities.length - 2}`);
  }
  if (parts.length === 0) {
    if (memberCount > 0) {
      return {
        text: `${memberCount} ${plural(memberCount, ["мастер", "мастера", "мастеров"])} · метки не заданы`,
        needsSetup: true,
      };
    }
    return { text: "Нужно настроить", needsSetup: true };
  }
  return { text: parts.join(" · "), needsSetup: false };
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

// ─── Long-press + tap hook ────────────────────────────────────────────

function useLongPressOrTap({
  onTap,
  onLongPress,
  isInsideDragHandle,
  delay = 500,
}: {
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  /** Optional target guard — return true to bail out so the drag
   *  handle element retains exclusive ownership of the gesture. */
  isInsideDragHandle?: (target: EventTarget | null) => boolean;
  delay?: number;
}) {
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (isInsideDragHandle?.(e.target)) {
        origin.current = null;
        return;
      }
      triggered.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        triggered.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(12);
        }
        if (origin.current) onLongPress(origin.current);
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: React.MouseEvent) => {
      if (triggered.current) {
        e.preventDefault();
        e.stopPropagation();
        triggered.current = false;
        return;
      }
      onTap();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}

// v519 §3.5 — desktop and mobile users get different interaction
// hints: swipe / long-press / single-tap only mean something on
// touch. On a viewport ≥ lg we show right-click + drag-handle copy
// instead, matching what actually works there.
function GestureHint() {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <div className="px-4 text-[12px] leading-snug text-[var(--label-tertiary)]">
        Клик — открыть. Правый клик — меню. Потяните за ручку&nbsp;☰ —
        переместить.
      </div>
    );
  }
  return (
    <div className="px-4 text-[12px] leading-snug text-[var(--label-tertiary)]">
      Нажмите — открыть. Свайп вправо —{" "}
      <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
        в архив
      </span>
      . Свайп влево —{" "}
      <span className="text-[var(--system-red)] font-medium">удалить</span>.
      Долгое нажатие — меню. Потяните за ручку&nbsp;☰ — переместить.
    </div>
  );
}
