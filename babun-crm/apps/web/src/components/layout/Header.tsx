"use client";

import { getMonthName } from "@/lib/date-utils";

interface HeaderProps {
  currentDate: Date;
  activeTeamId: string;
  teams: { id: string; name: string }[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTeamChange: (teamId: string) => void;
}

export default function Header({
  currentDate,
  activeTeamId,
  teams,
  onPrevWeek,
  onNextWeek,
  onToday,
  onTeamChange,
}: HeaderProps) {
  const monthName = getMonthName(currentDate.getMonth());
  const year = currentDate.getFullYear();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      {/* Left: Month/Year and navigation */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
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
      </div>

      {/* Right: Team tabs */}
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
    </header>
  );
}
