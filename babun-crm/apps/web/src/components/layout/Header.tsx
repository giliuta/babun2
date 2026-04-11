"use client";

import { useState } from "react";
import { getMonthName } from "@/lib/date-utils";
import MiniCalendar from "@/components/calendar/MiniCalendar";

interface HeaderAppointment {
  date: string;
}

export type ViewMode = "day" | "3days" | "week";

interface HeaderProps {
  currentDate: Date;
  activeTeamId: string;
  teams: { id: string; name: string }[];
  viewMode: ViewMode;
  hourHeight: number;
  allAppointments: HeaderAppointment[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTeamChange: (teamId: string) => void;
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
  onViewModeChange,
  onZoomIn,
  onZoomOut,
  onSelectDate,
  onMenuToggle,
}: HeaderProps) {
  const monthName = getMonthName(currentDate.getMonth());
  const year = currentDate.getFullYear();
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  return (
    <header className="flex-shrink-0 bg-indigo-700 lg:bg-white lg:border-b lg:border-gray-200 flex flex-col z-30">
      {/* Top row: hamburger + month + nav arrows + actions */}
      <div className="px-2 lg:px-4 py-2 lg:py-3 flex items-center gap-1 lg:gap-3">
        {/* Hamburger menu (mobile only) */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Меню"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-indigo-600 shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Month dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMiniCalendar(!showMiniCalendar)}
            className="flex items-center gap-1 hover:bg-indigo-600 lg:hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            <h2 className="text-base lg:text-lg font-semibold text-white lg:text-gray-900 capitalize whitespace-nowrap">
              {monthName} {year}
            </h2>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-indigo-200 lg:text-gray-400"
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

        {/* Spacer to push right items */}
        <div className="flex-1" />

        {/* Nav arrows (always visible) */}
        <div className="flex items-center gap-0.5 lg:gap-1">
          <button
            onClick={onPrevWeek}
            aria-label="Предыдущая неделя"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-600 lg:hover:bg-gray-100 text-white lg:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={onNextWeek}
            aria-label="Следующая неделя"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-600 lg:hover:bg-gray-100 text-white lg:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Today button */}
        <button
          onClick={onToday}
          className="px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium text-white bg-indigo-500/40 lg:text-indigo-600 lg:bg-indigo-50 rounded-lg hover:bg-indigo-500/60 lg:hover:bg-indigo-100 transition-colors"
        >
          Сегодня
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border border-white/30 lg:border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={onZoomOut}
            className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center hover:bg-indigo-500/50 lg:hover:bg-gray-100 text-white lg:text-gray-600"
            title="Уменьшить"
            aria-label="Уменьшить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="w-px h-4 lg:h-5 bg-white/30 lg:bg-gray-200" />
          <button
            onClick={onZoomIn}
            className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center hover:bg-indigo-500/50 lg:hover:bg-gray-100 text-white lg:text-gray-600"
            title="Увеличить"
            aria-label="Увеличить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* View mode dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            className="flex items-center gap-1 px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium text-white bg-indigo-500/40 lg:text-gray-700 lg:bg-gray-100 rounded-lg hover:bg-indigo-500/60 lg:hover:bg-gray-200 transition-colors"
          >
            {VIEW_MODE_LABELS[viewMode]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-200 lg:text-gray-400">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showViewDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowViewDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[120px]">
                {(["day", "3days", "week"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onViewModeChange(mode);
                      setShowViewDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
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
      <div className="bg-indigo-700 lg:bg-white px-2 lg:px-4 pb-1 lg:pb-3 flex items-center gap-3 lg:gap-1 overflow-x-auto scrollbar-hide">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => onTeamChange(team.id)}
            className={`px-3 lg:px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTeamId === team.id
                ? "text-white border-b-2 border-white lg:border-b-0 lg:bg-gray-100 lg:text-gray-900 lg:shadow-sm"
                : "text-indigo-200 lg:text-gray-500 hover:text-white lg:hover:text-gray-700"
            }`}
          >
            {team.name}
          </button>
        ))}
      </div>
    </header>
  );
}
