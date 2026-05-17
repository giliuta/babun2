"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Rows3,
  LayoutGrid,
  CalendarRange,
  Calendar as CalendarOneDay,
  List as ListIcon,
} from "@babun/shared/icons";
import { getMonthName } from "@babun/shared/common/utils/date-utils";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { haptic } from "@/lib/haptics";

interface HeaderAppointment {
  date: string;
}

export type ViewMode = "day" | "3days" | "week" | "month" | "agenda";

export interface HeaderTeamTab {
  id: string;
  name: string;
  /** Hex tint for the leading dot. Personal tab and untinted brigades
   *  may pass null/undefined; the dot is then omitted entirely. */
  color?: string | null;
}

interface HeaderProps {
  currentDate: Date;
  activeTeamId: string;
  teams: HeaderTeamTab[];
  /** Tab id that must stay locked at position 0 and NOT participate
   *  in drag-reorder. Used for the always-first personal calendar. */
  pinnedTeamId?: string;
  viewMode: ViewMode;
  allAppointments: HeaderAppointment[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTeamChange: (teamId: string) => void;
  /** v511 — fired after a successful drag-reorder. Receives the new
   *  order of brigade tab ids (excluding the pinned personal tab).
   *  Parent persists by upserting `sort_order` on each team. */
  onTeamsReorder?: (newOrderIds: string[]) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectDate: (monday: Date) => void;
  onMenuToggle: () => void;
}

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: "День",
  "3days": "3 дня",
  week: "Неделя",
  month: "Месяц",
  agenda: "Агенда",
};

export default function Header({
  currentDate,
  activeTeamId,
  teams,
  pinnedTeamId,
  viewMode,
  allAppointments,
  onPrevWeek,
  onNextWeek,
  onToday,
  onTeamChange,
  onTeamsReorder,
  onViewModeChange,
  onZoomIn,
  onZoomOut,
  onSelectDate,
  onMenuToggle,
}: HeaderProps) {
  void onZoomIn;
  void onZoomOut;
  void onMenuToggle;

  const monthName = getMonthName(currentDate.getMonth());
  const year = currentDate.getFullYear();
  const [todayNumber, setTodayNumber] = useState<number>(1);
  const [isOnToday, setIsOnToday] = useState(false);
  useEffect(() => {
    const now = new Date();
    setTodayNumber(now.getDate());
    setIsOnToday(
      viewMode === "day" &&
        now.getFullYear() === currentDate.getFullYear() &&
        now.getMonth() === currentDate.getMonth() &&
        now.getDate() === currentDate.getDate()
    );
  }, [currentDate, viewMode]);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  const VIEW_ICONS: Record<ViewMode, typeof CalendarOneDay> = {
    day: CalendarOneDay,
    "3days": Rows3,
    week: CalendarRange,
    month: LayoutGrid,
    agenda: ListIcon,
  };
  const ActiveViewIcon = VIEW_ICONS[viewMode];

  return (
    <header className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] flex flex-col z-30">
      <div className="px-2 lg:px-4 min-h-[44px] py-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="Предыдущий период"
          data-testid="header-prev"
          className="hidden lg:flex w-9 h-9 items-center justify-center rounded-full text-[var(--label-secondary)] hover:bg-[var(--fill-quaternary)] transition shrink-0"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Следующий период"
          data-testid="header-next"
          className="hidden lg:flex w-9 h-9 items-center justify-center rounded-full text-[var(--label-secondary)] hover:bg-[var(--fill-quaternary)] transition shrink-0"
        >
          <ChevronRight size={20} strokeWidth={2.2} />
        </button>

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowMiniCalendar(!showMiniCalendar)}
            className="flex items-center gap-1 active:bg-[var(--fill-quaternary)] rounded-full px-2.5 py-1.5 transition max-w-full"
          >
            <h2 className="text-[17px] font-semibold text-[var(--label)] capitalize whitespace-nowrap truncate tracking-tight">
              {monthName} {year}
            </h2>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className="text-[var(--label-tertiary)] flex-shrink-0"
            />
          </button>

          {showMiniCalendar && (
            <MiniCalendar
              currentDate={currentDate}
              appointments={allAppointments}
              onSelectDate={(monday) => {
                onSelectDate(monday);
                setShowMiniCalendar(false);
              }}
              onClose={() => setShowMiniCalendar(false)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onToday}
          aria-label={`Сегодня, ${todayNumber}`}
          // Brief 2 #4: native hover tooltip for the desktop user.
          // The icon (CalendarClock + day number) is recognizable but
          // not self-explanatory until you've used the app.
          title="Сегодня"
          hidden={isOnToday}
          data-testid="header-today"
          className="relative w-11 h-11 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] press-scale flex-shrink-0 transition"
        >
          <CalendarClock size={20} strokeWidth={2} />
          <span className="absolute text-[12px] font-bold translate-y-[3px]">
            {todayNumber}
          </span>
        </button>

        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            aria-label={`Вид: ${VIEW_MODE_LABELS[viewMode]}`}
            data-testid="header-view-mode"
            className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] press-scale transition"
          >
            <ActiveViewIcon size={20} strokeWidth={2} />
          </button>

          {showViewDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowViewDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 bg-[var(--surface-card)] rounded-[12px] shadow-[var(--shadow-sheet)] py-1 z-50 min-w-[140px] border border-[var(--separator)]">
                {(["day", "3days", "week", "month", "agenda"] as ViewMode[]).map((mode) => {
                  const Icon = VIEW_ICONS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        onViewModeChange(mode);
                        setShowViewDropdown(false);
                      }}
                      data-testid={`header-view-mode-option-${mode}`}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[14px] active:bg-[var(--fill-quaternary)] transition-colors ${
                        viewMode === mode
                          ? "text-[var(--accent)] font-semibold"
                          : "text-[var(--label)]"
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                      {VIEW_MODE_LABELS[mode]}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* v511 — team tabs reworked from a full-width iOS segmented
          control into a compact horizontally-scrollable chip strip
          (Telegram folder-tabs feel). Two reasons:
            1. The old segmented row forced every chip to flex-1, which
               clipped names with >2 brigades and ate the full row even
               with only «Мой календарь» + 1 brigade.
            2. The dispatcher asked for iPhone-jiggle reorder — long-press
               a chip and drag it into a new position. Drag-reorder is
               wired via @dnd-kit (same library as /dashboard/teams). The
               pinned personal-calendar tab is excluded from the sortable
               group so it always anchors position 0. */}
      <TeamTabStrip
        teams={teams}
        activeTeamId={activeTeamId}
        pinnedTeamId={pinnedTeamId}
        onTeamChange={onTeamChange}
        onTeamsReorder={onTeamsReorder}
      />
    </header>
  );
}

// ─── Team tab strip ──────────────────────────────────────────────────

interface TeamTabStripProps {
  teams: HeaderTeamTab[];
  activeTeamId: string;
  pinnedTeamId?: string;
  onTeamChange: (id: string) => void;
  onTeamsReorder?: (newOrderIds: string[]) => void;
}

function TeamTabStrip({
  teams,
  activeTeamId,
  pinnedTeamId,
  onTeamChange,
  onTeamsReorder,
}: TeamTabStripProps) {
  const { pinnedTab, sortableTabs } = useMemo(() => {
    if (!pinnedTeamId) {
      return { pinnedTab: undefined, sortableTabs: teams };
    }
    const pinned = teams.find((t) => t.id === pinnedTeamId);
    const rest = teams.filter((t) => t.id !== pinnedTeamId);
    return { pinnedTab: pinned, sortableTabs: rest };
  }, [teams, pinnedTeamId]);

  // 500 ms hold + 6 px tolerance — matches the activation constraint
  // used on /dashboard/teams sortable list, so taps and horizontal
  // scrolling still belong to the strip while a deliberate hold opens
  // the reorder gesture. TouchSensor mirrors PointerSensor for iOS PWA
  // where pointer events sometimes arrive as touch only.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 500, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 6 },
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    haptic("warning");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableTabs.findIndex((t) => t.id === active.id);
    const newIdx = sortableTabs.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    haptic("tap");
    const next = arrayMove(sortableTabs, oldIdx, newIdx);
    onTeamsReorder?.(next.map((t) => t.id));
  };

  return (
    <div className="px-3 lg:px-4 pb-2 overflow-x-auto scrollbar-hide touch-pan-x">
      <div className="inline-flex items-center gap-2 min-w-min">
        {pinnedTab && (
          <TeamChip
            team={pinnedTab}
            active={activeTeamId === pinnedTab.id}
            onClick={() => onTeamChange(pinnedTab.id)}
          />
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableTabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="inline-flex items-center gap-2">
              {sortableTabs.map((team) => (
                <SortableTeamChip
                  key={team.id}
                  team={team}
                  active={activeTeamId === team.id}
                  onClick={() => onTeamChange(team.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// ─── Team chip (presentational) ──────────────────────────────────────

interface TeamChipProps {
  team: HeaderTeamTab;
  active: boolean;
  onClick: () => void;
  // Drag-state props injected by SortableTeamChip wrapper. Plain chips
  // (pinned personal tab) omit them entirely.
  dragSetNodeRef?: (node: HTMLElement | null) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragStyle?: React.CSSProperties;
  isDragging?: boolean;
}

function TeamChip({
  team,
  active,
  onClick,
  dragSetNodeRef,
  dragHandleProps,
  dragStyle,
  isDragging = false,
}: TeamChipProps) {
  // The dragged chip lifts above its peers (scale + shadow + rotate)
  // for the iOS "picked up" feel. Other chips stay flat; SortableContext
  // animates their translation as the dragged chip moves through them.
  const tone = active
    ? "bg-[var(--accent-tint)] text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]"
    : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-quaternary)]";
  return (
    <button
      ref={dragSetNodeRef}
      type="button"
      onClick={onClick}
      data-testid={`header-team-tab-${team.id}`}
      data-team-id={team.id}
      {...dragHandleProps}
      style={dragStyle}
      className={`relative flex items-center gap-1.5 px-3 h-8 max-w-[180px] rounded-full text-[13px] font-semibold whitespace-nowrap select-none transition-shadow ${tone} ${
        isDragging
          ? "z-20 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.25)] scale-[1.06] rotate-[-1.5deg] cursor-grabbing"
          : ""
      }`}
    >
      {team.color && (
        <span
          aria-hidden
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: team.color }}
        />
      )}
      <span className="truncate">{team.name}</span>
    </button>
  );
}

// ─── Sortable chip wrapper ───────────────────────────────────────────

function SortableTeamChip({
  team,
  active,
  onClick,
}: {
  team: HeaderTeamTab;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // dnd-kit's listeners include onPointerDown — we want the button's
  // onClick to still fire on a quick tap (the activation-constraint
  // delay ensures drag never starts on a tap). Spreading listeners onto
  // the button is the canonical pattern and is the same shape used in
  // /dashboard/teams's SortableRow.
  return (
    <TeamChip
      team={team}
      active={active}
      onClick={onClick}
      dragSetNodeRef={setNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragStyle={dragStyle}
      isDragging={isDragging}
    />
  );
}
