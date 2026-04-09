"use client";

import { useState } from "react";
import { getMonthName } from "@/lib/date-utils";
import type { MockAppointment } from "@/lib/mock-data";
import MiniCalendar from "@/components/calendar/MiniCalendar";

export type ViewMode = "day" | "3days" | "week";

interface HeaderProps {
  currentDate: Date;
  activeTeamId: string;
  teams: { id: string; name: string }[];
  viewMode: ViewMode;
  hourHeight: number;
  allAppointments: MockAppointment[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTeamChange: (teamId: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectDate: (monday: Date) => void;
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
}: HeaderProps) {
  const monthName = getMonthName(currentDate.getMonth());
  const year = currentDate.getFullYear();
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      {/* Left: Month/Year and navigation */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowMiniCalendar(!showMiniCalendar)}
            className="flex items-center gap-1 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              {monthName} {year}
            </h2>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-400"
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

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={onNextWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          Сегодня
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={onZoomOut}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600 text-sm"
            title="Уменьшить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 15 12 9 18 15" />
            </svg>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={onZoomIn}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600 text-sm"
            title="Увеличить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right: View mode + Team tabs */}
      <div className="flex items-center gap-3">
        {/* View mode dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {VIEW_MODE_LABELS[viewMode]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
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

        {/* Team tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => onTeamChange(team.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTeamId === team.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
