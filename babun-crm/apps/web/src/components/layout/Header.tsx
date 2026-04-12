"use client";

import { useRef, useState } from "react";
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
  onPrevWeek,
  onNextWeek,
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
  const todayNumber = new Date().getDate();
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  return (
    <header className="flex-shrink-0 bg-violet-600 lg:bg-white lg:border-b lg:border-gray-200 flex flex-col z-30">
      {/* Top row — icon-first, compact */}
      <div className="px-2 lg:px-4 py-2.5 lg:py-3 flex items-center gap-1.5 lg:bg-white">
        {/* Hamburger */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Меню"
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 flex-shrink-0 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Month + year (tap = mini calendar) */}
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowMiniCalendar(!showMiniCalendar)}
            className="flex items-center gap-1 active:bg-white/10 lg:hover:bg-gray-50 rounded-xl px-2.5 py-1.5 active:scale-[0.98] transition max-w-full"
          >
            <h2 className="text-[15px] lg:text-lg font-semibold text-white lg:text-gray-900 capitalize whitespace-nowrap truncate tracking-tight">
              {monthName} {year}
            </h2>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-white/70 lg:text-gray-400 flex-shrink-0"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
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

        {/* Prev week */}
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="Предыдущая неделя"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 lg:text-gray-600 lg:hover:bg-gray-100 active:scale-[0.94] flex-shrink-0 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Next week */}
        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Следующая неделя"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 lg:text-gray-600 lg:hover:bg-gray-100 active:scale-[0.94] flex-shrink-0 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Today — calendar icon with current day number inside */}
        <button
          type="button"
          onClick={onToday}
          aria-label="Сегодня"
          className="relative w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 lg:text-gray-600 lg:hover:bg-gray-100 active:scale-[0.94] flex-shrink-0 transition"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="absolute text-[9px] font-bold translate-y-[3px]">
            {todayNumber}
          </span>
        </button>

        {/* View mode — opens a small dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            aria-label={`Вид: ${VIEW_MODE_LABELS[viewMode]}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 lg:text-gray-600 lg:hover:bg-gray-100 active:scale-[0.94] transition"
          >
            {viewMode === "day" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="3" width="10" height="18" rx="1.5" />
              </svg>
            ) : viewMode === "3days" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="10" y="3" width="5" height="18" rx="1" />
                <rect x="17" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : viewMode === "week" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="1.5" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="14" x2="21" y2="14" />
                <line x1="9" y1="4" x2="9" y2="20" />
                <line x1="15" y1="4" x2="15" y2="20" />
              </svg>
            )}
          </button>

          {showViewDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowViewDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[120px]">
                {(["day", "3days", "week", "month"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      onViewModeChange(mode);
                      setShowViewDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors ${
                      viewMode === mode
                        ? "text-indigo-600 font-medium bg-indigo-50"
                        : "text-gray-700"
                    }`}
                  >
                    {VIEW_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: team tabs */}
      <div className="bg-violet-600 lg:bg-white px-2 lg:px-4 pb-1.5 lg:pb-3 flex items-center gap-3 lg:gap-1 overflow-x-auto scrollbar-hide">
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
      className={`px-3 lg:px-4 py-1.5 text-[13px] font-semibold whitespace-nowrap select-none transition ${
        active
          ? "text-white border-b-2 border-white lg:border-b-0 lg:bg-gray-100 lg:text-gray-900"
          : "text-violet-200 lg:text-gray-500 hover:text-white lg:hover:text-gray-700"
      }`}
    >
      {team.name}
    </button>
  );
}
