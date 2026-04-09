"use client";

import { useState } from "react";

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 bg-indigo-900 text-white rounded-lg flex items-center justify-center shadow-lg"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[220px] bg-indigo-900 text-white flex flex-col z-40 transition-transform duration-200 ${
          collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        }`}
      >
        {/* Account info */}
        <div className="px-4 pt-5 pb-3 border-b border-indigo-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-700 rounded-full flex items-center justify-center text-sm font-bold">
              A
            </div>
            <div className="text-xs text-indigo-200 truncate">
              airfix.cy@gmail.com
            </div>
          </div>
          <a
            href="#"
            className="text-xs text-indigo-300 hover:text-white flex items-center gap-1"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Профиль мастера
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            label="Клиенты"
            active
          />
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
            label="Доходы"
            hasAction
          />
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
            label="Расходы"
            hasAction
          />
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
            }
            label="Отчеты и планирование"
          />
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M3 9h18" />
              </svg>
            }
            label="Лист ожидания"
            badge={3}
          />
          <NavItem
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            }
            label="Настройки"
          />
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-3 border-t border-indigo-800">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-indigo-300 hover:text-white w-full"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Выход
          </button>
          <div className="text-[10px] text-indigo-400 mt-2">
            Синхр.: {new Date().toLocaleString("ru-RU", { timeZone: "Asia/Nicosia" })}
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  icon,
  label,
  active,
  hasAction,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  hasAction?: boolean;
  badge?: number;
}) {
  return (
    <a
      href="#"
      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
        active
          ? "bg-indigo-800 text-white"
          : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {hasAction && (
        <span className="w-5 h-5 bg-indigo-700 rounded text-xs flex items-center justify-center text-indigo-200 hover:bg-indigo-600">
          +
        </span>
      )}
      {badge !== undefined && (
        <span className="min-w-[20px] h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white px-1">
          {badge}
        </span>
      )}
    </a>
  );
}
