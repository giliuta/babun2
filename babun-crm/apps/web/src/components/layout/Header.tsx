"use client";

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  ChevronDown,
  CalendarClock,
  Rows3,
  LayoutGrid,
  CalendarRange,
  Calendar as CalendarOneDay,
} from "lucide-react";
import { getMonthName } from "@/lib/date-utils";
import MiniCalendar from "@/components/calendar/MiniCalendar";

interface HeaderAppointment {
  date: string;
}

export type ViewMode = "day" | "3days" | "week" | "month";

interface HeaderProps {
  currentDate: Date;
  activeTeamId: string;
  teams: { id: string; name: string }[];
  viewMode: ViewMode;
  allAppointments: HeaderAppointment[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTeamChange: (teamId: string) => void;
  onTeamLongPress?: (teamId: string) => void;
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
};

export default function Header({
  currentDate,
  activeTeamId,
  teams,
  viewMode,
  allAppointments,
  onPrevWeek: _onPrevWeek,
  onNextWeek: _onNextWeek,
  onToday,
  onTeamChange,
  onTeamLongPress,
  onViewModeChange,
  onZoomIn,
  onZoomOut,
  onSelectDate,
  onMenuToggle,
}: HeaderProps) {
  // zoom controls are reachable via pinch/ctrl+wheel; silence unused-prop warning
  void onZoomIn;
  void onZoomOut;

  const monthName = getMonthName(currentDate.getMonth());
  const year = currentDate.getFullYear();
  // `new Date()` in render caused a hydration mismatch when the Vercel
  // build clock and the client crossed Cyprus midnight. Defer to
  // useEffect so SSR ships a stable default (1) and the real number
  // appears on the client only.
  const [todayNumber, setTodayNumber] = useState<number>(1);
  // Sprint 025: when the dispatcher is already on today's column in
  // day view, the "Сегодня" icon does nothing — hide it to reclaim
  // thumb-space. In 3-day / week / month views keep it visible because
  // "today" may scroll off the visible range.
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
  };
  const ActiveViewIcon = VIEW_ICONS[viewMode];

  return (
    <header className="flex-shrink-0 bg-[var(--accent)] lg:bg-[var(--surface-card)] lg:border-b lg:border-[var(--separator)] flex flex-col z-30">
      <div className="px-2 lg:px-4 min-h-[44px] py-1.5 flex items-center gap-1 lg:bg-[var(--surface-card)]">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Меню"
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-white active:bg-white/10 flex-shrink-0 transition"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowMiniCalendar(!showMiniCalendar)}
            className="flex items-center gap-1 active:bg-white/10 lg:active:bg-[var(--fill-quaternary)] rounded-full px-2.5 py-1.5 transition max-w-full"
          >
            <h2 className="text-[17px] font-semibold text-white lg:text-[var(--label)] capitalize whitespace-nowrap truncate tracking-tight">
              {monthName} {year}
            </h2>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className="text-white/70 lg:text-[var(--label-tertiary)] flex-shrink-0"
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
          hidden={isOnToday}
          className="relative w-10 h-10 flex items-center justify-center rounded-full text-white active:bg-white/10 lg:text-[var(--label-secondary)] lg:active:bg-[var(--fill-quaternary)] flex-shrink-0 transition"
        >
          <CalendarClock size={20} strokeWidth={2} />
          <span className="absolute text-[9px] font-bold translate-y-[3px]">
            {todayNumber}
          </span>
        </button>

        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            aria-label={`Вид: ${VIEW_MODE_LABELS[viewMode]}`}
            className="w-10 h-10 flex items-center justify-center rounded-full text-white active:bg-white/10 lg:text-[var(--label-secondary)] lg:active:bg-[var(--fill-quaternary)] transition"
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
                {(["day", "3days", "week", "month"] as ViewMode[]).map((mode) => {
                  const Icon = VIEW_ICONS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        onViewModeChange(mode);
                        setShowViewDropdown(false);
                      }}
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

      <div className="bg-[var(--accent)] lg:bg-[var(--surface-card)] px-2 lg:px-4 pb-1 lg:pb-2 flex items-center gap-4 lg:gap-1 overflow-x-auto scrollbar-hide">
        {teams.map((team) => (
          <TeamTab
            key={team.id}
            team={team}
            active={activeTeamId === team.id}
            onClick={() => onTeamChange(team.id)}
            onLongPress={
              onTeamLongPress ? () => onTeamLongPress(team.id) : undefined
            }
          />
        ))}
      </div>
    </header>
  );
}

interface TeamTabProps {
  team: { id: string; name: string };
  active: boolean;
  onClick: () => void;
  onLongPress?: () => void;
}

// Team tab with its own long-press detector so the parent can swap
// the tab's position with its neighbor (AirFix style reorder).
function TeamTab({ team, active, onClick, onLongPress }: TeamTabProps) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const start = () => {
    firedRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress?.();
    }, 550);
  };

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (firedRef.current) {
          firedRef.current = false;
          return;
        }
        onClick();
      }}
      onPointerDown={start}
      onPointerMove={cancel}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.();
        firedRef.current = true;
      }}
      className={`px-3 lg:px-4 py-2 text-[14px] font-semibold whitespace-nowrap select-none transition tracking-tight ${
        active
          ? "text-white border-b-2 border-white lg:border-b-0 lg:bg-[var(--fill-tertiary)] lg:text-[var(--label)] lg:rounded-full"
          : "text-white/70 lg:text-[var(--label-secondary)]"
      }`}
    >
      {team.name}
    </button>
  );
}
