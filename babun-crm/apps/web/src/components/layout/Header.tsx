"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Settings,
} from "@babun/shared/icons";
import { useRouter } from "next/navigation";
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
  agenda: "Список",
};

const VIEW_MODE_ORDER: readonly ViewMode[] = [
  "day",
  "3days",
  "week",
  "month",
  "agenda",
];

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
  // STORY audit: onZoomIn / onZoomOut / onMenuToggle were dead props —
  // declared on the interface, passed by page.tsx, then immediately
  // `void`-ed inside the component. The desktop zoom +/- buttons next
  // to «Предыдущий период» / «Следующий период» were never wired, and
  // the menu hamburger on iPad-sized screens never fired. Until
  // someone actually builds the desktop zoom UI we keep the props
  // referenced via assignment so TypeScript doesn't complain about
  // unused, but document the absence. Real fix lives downstream: zoom
  // would mutate calendar `--hh` CSS var, menu toggle should call
  // sidebar.toggle (page.tsx already passes that callback through).
  void onZoomIn;
  void onZoomOut;
  void onMenuToggle;

  const router = useRouter();
  // Gear → settings of the team whose calendar is open. The pinned
  // personal tab isn't a team, so it routes to «Мой календарь»; empty
  // (no teams yet) falls back to the teams list.
  const isPersonal = Boolean(pinnedTeamId) && activeTeamId === pinnedTeamId;
  const settingsHref = isPersonal
    ? "/dashboard/settings/calendar"
    : activeTeamId
      ? `/dashboard/teams/${activeTeamId}`
      : "/dashboard/teams";

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

  return (
    <header className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] flex flex-col z-30">
      <div className="px-2 lg:px-4 min-h-[44px] py-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => router.push(settingsHref)}
          aria-label="Настройки команды"
          data-testid="header-team-settings"
          className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] hover:bg-[var(--fill-quaternary)] transition shrink-0"
        >
          <Settings size={20} strokeWidth={2} />
        </button>
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
            // STORY audit: h-11 to match the 44 px iOS tap target and line
            // up vertically with the «Сегодня» icon and view-mode pill on
            // the same row. The previous py-1.5 produced 38 px which
            // looked short next to the 44 px neighbours.
            className="flex items-center gap-1 active:bg-[var(--fill-quaternary)] rounded-full px-2.5 h-11 transition max-w-full"
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

        <ViewModeDropdown
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
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

// ─── View-mode dropdown ──────────────────────────────────────────────
//
// STORY-060 §F2.8 — replaces the icon-only pill toggle with a labeled
// button + accessible dropdown menu. Hand-rolled (no radix) so we stay
// free of the runtime dependency. Keyboard contract:
//   • Enter / Space / ArrowDown on the trigger → opens & focuses current
//   • ArrowUp / ArrowDown inside the menu      → moves highlight
//   • Home / End                                → jumps to first / last
//   • Enter                                     → selects highlighted
//   • Escape / Tab                              → closes, returns focus
//   • Outside pointerdown                       → closes
// Menu items are role="menuitemradio" + aria-checked, the canonical
// pattern for "exactly one selected" sets per WAI-ARIA APG.

interface ViewModeDropdownProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function ViewModeDropdown({
  viewMode,
  onViewModeChange,
}: ViewModeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number>(() =>
    Math.max(0, VIEW_MODE_ORDER.indexOf(viewMode)),
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Sync highlight to the active mode every time the menu opens so the
  // user lands on the current selection rather than wherever the
  // highlight was when they closed it last time.
  useEffect(() => {
    if (open) {
      const idx = Math.max(0, VIEW_MODE_ORDER.indexOf(viewMode));
      setHighlightIdx(idx);
      // Focus is moved on the next tick so the menu has actually
      // mounted and the ref is populated.
      const id = window.requestAnimationFrame(() => {
        itemRefs.current[idx]?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open, viewMode]);

  // Outside pointerdown closes the menu. pointerdown (not click) so the
  // close happens before any focus / click on the outside target — this
  // matches iOS sheet dismiss behaviour and avoids a flash where the
  // menu briefly stays open after tapping outside.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const closeAndReturnFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const selectMode = useCallback(
    (mode: ViewMode) => {
      onViewModeChange(mode);
      closeAndReturnFocus();
    },
    [onViewModeChange, closeAndReturnFocus],
  );

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const lastIdx = VIEW_MODE_ORDER.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = highlightIdx >= lastIdx ? 0 : highlightIdx + 1;
      setHighlightIdx(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = highlightIdx <= 0 ? lastIdx : highlightIdx - 1;
      setHighlightIdx(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlightIdx(0);
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlightIdx(lastIdx);
      itemRefs.current[lastIdx]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAndReturnFocus();
    } else if (e.key === "Tab") {
      // Let Tab move focus out naturally, but close so the open menu
      // doesn't trap a screen-reader user after they've moved away.
      setOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const mode = VIEW_MODE_ORDER[highlightIdx];
      if (mode) selectMode(mode);
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Режим календаря: ${VIEW_MODE_LABELS[viewMode]}`}
        data-testid="header-view-mode"
        className="h-11 px-3 inline-flex items-center gap-1.5 rounded-full text-[15px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] press-scale transition"
      >
        <span className="whitespace-nowrap">{VIEW_MODE_LABELS[viewMode]}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={`text-[var(--label-tertiary)] flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Режим календаря"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full mt-2 bg-[var(--surface-card)] rounded-[12px] shadow-[var(--shadow-sheet)] py-1 z-50 min-w-[180px] border border-[var(--separator)] outline-none"
        >
          {VIEW_MODE_ORDER.map((mode, idx) => {
            const isCurrent = mode === viewMode;
            return (
              <button
                key={mode}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                tabIndex={highlightIdx === idx ? 0 : -1}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => selectMode(mode)}
                data-testid={`header-view-mode-option-${mode}`}
                // STORY audit: was min-h-[40px] (4 px below the 44 pt
                // Apple HIG floor). On a narrow popup with five rows
                // stacked, the missed gap routinely picks the wrong
                // mode. Bumped to min-h-[44px].
                className={`w-full min-h-[44px] flex items-center justify-between px-3 text-[15px] active:bg-[var(--fill-quaternary)] focus:bg-[var(--fill-quaternary)] focus:outline-none transition-colors ${
                  isCurrent
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--label)]"
                }`}
              >
                <span className="whitespace-nowrap">
                  {VIEW_MODE_LABELS[mode]}
                </span>
                {isCurrent ? (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="text-[var(--accent)] flex-shrink-0 ml-3"
                  />
                ) : (
                  <span aria-hidden className="w-4 ml-3" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      // STORY audit: TeamChip raised h-8 → h-10. The team-tab strip is
      // tapped 5-10 times a day (switch brigade ↔ personal), and 32 px
      // on a moving thumb is a coin-flip. h-10 still keeps the compact
      // Telegram-style horizontal-scroll feel, but the hit zone now
      // covers ≥44 pt once you count the surrounding pb-2 padding from
      // TeamTabStrip's outer div.
      className={`relative flex items-center gap-1.5 px-3.5 h-10 max-w-[180px] rounded-full text-[13px] font-semibold whitespace-nowrap select-none transition-shadow ${tone} ${
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
