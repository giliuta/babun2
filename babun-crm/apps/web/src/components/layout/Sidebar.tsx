"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadWaitlist } from "@/lib/waitlist";
import { BUILD_VERSION } from "@/lib/version";

export type DialogType =
  | "calendar"
  | "clients"
  | "finances"
  | "waitlist"
  | "settings"
  | "master-profile"
  | "masters"
  | "teams"
  | "services"
  | "sms-templates"
  | "schedule"
  | "route"
  | null;

interface SidebarProps {
  onLogout: () => void;
  onNavigate?: (dialog: DialogType) => void; // legacy / unused — kept for backward compat
  open: boolean;
  onClose: () => void;
}

const ROUTE_MAP: Record<Exclude<DialogType, null>, string> = {
  calendar: "/dashboard",
  clients: "/dashboard/clients",
  finances: "/dashboard/finances",
  waitlist: "/dashboard/waitlist",
  settings: "/dashboard/settings",
  "master-profile": "/dashboard/master-profile",
  masters: "/dashboard/masters",
  teams: "/dashboard/teams",
  services: "/dashboard/services",
  "sms-templates": "/dashboard/sms-templates",
  schedule: "/dashboard/schedule",
  route: "/dashboard/route",
};

export default function Sidebar({ onLogout, open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [waitlistPending, setWaitlistPending] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setWaitlistPending(
        loadWaitlist().filter((i) => i.status === "pending").length
      );
    };
    refresh();
    // Re-read when the drawer is reopened or the user navigates — cheap
    // enough to avoid a store abstraction for now.
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [open, pathname]);

  const handleNav = (dialog: DialogType) => {
    if (dialog) {
      router.push(ROUTE_MAP[dialog]);
    }
    onClose();
  };

  const isActive = (dialog: Exclude<DialogType, null>) => pathname === ROUTE_MAP[dialog];

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar — deep purple */}
      <aside
        className={`fixed top-0 left-0 h-full w-[240px] bg-violet-900 text-white flex flex-col z-40 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4 border-b border-violet-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-violet-700 rounded-full flex items-center justify-center text-sm font-bold">
              B
            </div>
            <div className="text-xs text-violet-200 truncate">
              airfix.cy@gmail.com
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleNav("master-profile")}
            className={`text-xs flex items-center gap-1 ${
              isActive("master-profile") ? "text-white" : "text-violet-300 hover:text-white"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Профиль мастера
          </button>
        </div>

        {/* Navigation — grouped into semantic sections */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <SectionLabel>Работа</SectionLabel>
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            label="Календарь"
            active={isActive("calendar")}
            onClick={() => handleNav("calendar")}
          />
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            label="Клиенты"
            active={isActive("clients")}
            onClick={() => handleNav("clients")}
          />
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            }
            label="Маршрут дня"
            active={isActive("route")}
            onClick={() => handleNav("route")}
          />
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M3 9h18" />
              </svg>
            }
            label="Лист ожидания"
            badge={waitlistPending > 0 ? waitlistPending : undefined}
            active={isActive("waitlist")}
            onClick={() => handleNav("waitlist")}
          />

          <SectionLabel>Деньги</SectionLabel>
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
            label="Финансы"
            active={isActive("finances")}
            onClick={() => handleNav("finances")}
          />

          <SectionLabel>Команда</SectionLabel>
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            label="Бригады и мастера"
            active={isActive("teams") || isActive("masters")}
            onClick={() => handleNav("teams")}
          />
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            label="Расписание"
            active={isActive("schedule")}
            onClick={() => handleNav("schedule")}
          />

          <SectionLabel>Настройка</SectionLabel>
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
            }
            label="Услуги"
            active={isActive("services")}
            onClick={() => handleNav("services")}
          />
          <NavItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            }
            label="SMS-шаблоны"
            active={isActive("sms-templates")}
            onClick={() => handleNav("sms-templates")}
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
            active={isActive("settings")}
            onClick={() => handleNav("settings")}
          />
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-3 border-t border-violet-800">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-violet-300 hover:text-white w-full"
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
          <div className="text-[10px] text-violet-400 mt-2">
            Синхр. {new Date().toLocaleString("ru-RU", { timeZone: "Asia/Nicosia", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-[10px] text-violet-300/70 mt-1 font-mono tracking-wide">
            {BUILD_VERSION}
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-wider text-violet-400">
      {children}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  hasAction,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  hasAction?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
        active
          ? "bg-violet-800 text-white"
          : "text-violet-200 hover:bg-violet-800 hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
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
    </button>
  );
}
