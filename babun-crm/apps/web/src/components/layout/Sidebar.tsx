"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  Navigation,
  ClipboardList,
  RotateCcw,
  Wallet,
  Receipt,
  Banknote,
  BarChart3,
  LayoutGrid,
  Clock as ClockIcon,
  Wrench,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { loadWaitlist } from "@/lib/waitlist";
import { loadRecurring, dueReminders } from "@/lib/recurring";
import { loadChats, getTotalUnread } from "@/lib/chats";
import { BUILD_VERSION } from "@/lib/version";

export type DialogType =
  | "calendar"
  | "clients"
  | "chats"
  | "finances"
  | "expenses"
  | "payroll"
  | "reports"
  | "waitlist"
  | "recurring"
  | "settings"
  | "masters"
  | "teams"
  | "brigades"
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
  chats: "/dashboard/chats",
  finances: "/dashboard/finances",
  expenses: "/dashboard/expenses",
  payroll: "/dashboard/payroll",
  reports: "/dashboard/reports",
  waitlist: "/dashboard/waitlist",
  recurring: "/dashboard/recurring",
  settings: "/dashboard/settings",
  masters: "/dashboard/masters",
  teams: "/dashboard/teams",
  brigades: "/dashboard/brigades",
  services: "/dashboard/services",
  "sms-templates": "/dashboard/sms-templates",
  schedule: "/dashboard/schedule",
  route: "/dashboard/route",
};

export default function Sidebar({ onLogout, open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [waitlistPending, setWaitlistPending] = useState(0);
  const [recurringDue, setRecurringDue] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setWaitlistPending(
        loadWaitlist().filter((i) => i.status === "pending").length
      );
      setRecurringDue(dueReminders(loadRecurring()).length);
      setUnreadChats(getTotalUnread(loadChats()));
    };
    refresh();
    // Re-read when the drawer is reopened or the user navigates — cheap
    // enough to avoid a store abstraction for now.
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("babun:recurring-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("babun:recurring-changed", refresh);
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
        </div>

        {/* Navigation — grouped into semantic sections */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <SectionLabel>Работа</SectionLabel>
          <NavItem
            icon={<CalendarIcon size={18} strokeWidth={2} />}
            label="Календарь"
            active={isActive("calendar")}
            onClick={() => handleNav("calendar")}
          />
          <NavItem
            icon={<UsersIcon size={18} strokeWidth={2} />}
            label="Клиенты"
            active={isActive("clients")}
            onClick={() => handleNav("clients")}
          />
          <NavItem
            icon={<MessageSquare size={18} strokeWidth={2} />}
            label="Чаты"
            badge={unreadChats > 0 ? unreadChats : undefined}
            active={isActive("chats")}
            onClick={() => handleNav("chats")}
          />
          <NavItem
            icon={<Navigation size={18} strokeWidth={2} />}
            label="Маршрут дня"
            active={isActive("route")}
            onClick={() => handleNav("route")}
          />
          <NavItem
            icon={<ClipboardList size={18} strokeWidth={2} />}
            label="Лист ожидания"
            badge={waitlistPending > 0 ? waitlistPending : undefined}
            active={isActive("waitlist")}
            onClick={() => handleNav("waitlist")}
          />
          <NavItem
            icon={<RotateCcw size={18} strokeWidth={2} />}
            label="Напоминания"
            badge={recurringDue > 0 ? recurringDue : undefined}
            active={isActive("recurring")}
            onClick={() => handleNav("recurring")}
          />

          <SectionLabel>Деньги</SectionLabel>
          <NavItem
            icon={<Wallet size={18} strokeWidth={2} />}
            label="Финансы"
            active={isActive("finances")}
            onClick={() => handleNav("finances")}
          />
          <NavItem
            icon={<Receipt size={18} strokeWidth={2} />}
            label="Расходы"
            active={isActive("expenses")}
            onClick={() => handleNav("expenses")}
          />
          <NavItem
            icon={<Banknote size={18} strokeWidth={2} />}
            label="Зарплата"
            active={isActive("payroll")}
            onClick={() => handleNav("payroll")}
          />
          <NavItem
            icon={<BarChart3 size={18} strokeWidth={2} />}
            label="Отчёты"
            active={isActive("reports")}
            onClick={() => handleNav("reports")}
          />

          <SectionLabel>Команда</SectionLabel>
          <NavItem
            icon={<UsersIcon size={18} strokeWidth={2} />}
            label="Бригады и мастера"
            active={isActive("teams") || isActive("masters")}
            onClick={() => handleNav("teams")}
          />
          <NavItem
            icon={<LayoutGrid size={18} strokeWidth={2} />}
            label="Фин. бригады (% ставки)"
            active={isActive("brigades")}
            onClick={() => handleNav("brigades")}
          />
          <NavItem
            icon={<ClockIcon size={18} strokeWidth={2} />}
            label="Расписание"
            active={isActive("schedule")}
            onClick={() => handleNav("schedule")}
          />

          <SectionLabel>Настройка</SectionLabel>
          <NavItem
            icon={<Wrench size={18} strokeWidth={2} />}
            label="Услуги"
            active={isActive("services")}
            onClick={() => handleNav("services")}
          />
          <NavItem
            icon={<MessageSquare size={18} strokeWidth={2} />}
            label="SMS-шаблоны"
            active={isActive("sms-templates")}
            onClick={() => handleNav("sms-templates")}
          />
          <NavItem
            icon={<SettingsIcon size={18} strokeWidth={2} />}
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
            <LogOut size={16} strokeWidth={2} />
            Выход
          </button>
          <div className="text-[10px] text-violet-400 mt-2">
            Синхр. <SyncTime />
          </div>
          <div className="text-[10px] text-violet-300/70 mt-1 font-mono tracking-wide">
            {BUILD_VERSION}
          </div>
        </div>
      </aside>
    </>
  );
}

// Sync timestamp lives in its own client-only component so the parent
// can SSR a stable empty placeholder. Putting `new Date()` directly in
// render caused React #418 hydration mismatch on every dashboard load
// (the build-time HTML and the client clock disagreed on the minute).
// Sprint 023 hotfix.
function SyncTime() {
  const [label, setLabel] = useState<string>("…");
  useEffect(() => {
    const tick = () =>
      setLabel(
        new Date().toLocaleString("ru-RU", {
          timeZone: "Asia/Nicosia",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
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
        <span className="w-5 h-5 bg-violet-700 rounded text-xs flex items-center justify-center text-violet-200 hover:bg-violet-600">
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
