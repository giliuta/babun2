"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  UserCircle2,
  RotateCcw,
  Wallet,
  Wrench,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { loadRecurring, dueReminders } from "@/lib/recurring";
import { loadChats, getTotalUnread } from "@/lib/chats";
import { BUILD_VERSION } from "@/lib/version";
import { ICON_TONE_BG, type IconTone } from "@/lib/design-tokens";

// Sprint 029 Phase 1: the sidebar moves to iOS grouped-list aesthetics.
// White canvas with the brand-violet Babun header, tinted rounded-square
// icon tiles per row (mirrors iOS Settings), soft slate-100 dividers.
// Admin surfaces stay behind a "Показать всё" toggle so the primary
// set doesn't balloon.

export type DialogType =
  | "calendar"
  | "clients"
  | "chats"
  | "finances"
  | "recurring"
  | "settings"
  | "masters"
  | "teams"
  | "services"
  | "sms-templates"
  | null;

interface SidebarProps {
  onLogout: () => void;
  onNavigate?: (dialog: DialogType) => void;
  open: boolean;
  onClose: () => void;
}

const ROUTE_MAP: Record<Exclude<DialogType, null>, string> = {
  calendar: "/dashboard",
  clients: "/dashboard/clients",
  chats: "/dashboard/chats",
  finances: "/dashboard/finances",
  recurring: "/dashboard/recurring",
  settings: "/dashboard/settings",
  masters: "/dashboard/masters",
  teams: "/dashboard/teams",
  services: "/dashboard/services",
  "sms-templates": "/dashboard/sms-templates",
};

const EXPAND_KEY = "babun-sidebar-expanded";

export default function Sidebar({ onLogout, open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [recurringDue, setRecurringDue] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setExpanded(window.localStorage.getItem(EXPAND_KEY) === "1");
  }, []);

  useEffect(() => {
    const refresh = () => {
      setRecurringDue(dueReminders(loadRecurring()).length);
      setUnreadChats(getTotalUnread(loadChats()));
    };
    refresh();
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

  const isActive = (dialog: Exclude<DialogType, null>) =>
    pathname === ROUTE_MAP[dialog];

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EXPAND_KEY, next ? "1" : "0");
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-[var(--surface-grouped)] flex flex-col z-40 transition-transform duration-300 shadow-[10px_0_30px_-20px_rgba(0,0,0,0.2)] lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand header — violet for the Babun identity, matches calendar nav. */}
        <div className="flex-shrink-0 bg-[var(--accent)] px-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center text-white text-[17px] font-bold">
              B
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-white leading-tight">
                Babun CRM
              </div>
              <div className="text-[12px] text-white/70 truncate">
                airfix.cy@gmail.com
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <Group>
            <NavRow
              icon={CalendarIcon}
              tone="violet"
              label="Календарь"
              active={isActive("calendar")}
              onClick={() => handleNav("calendar")}
            />
            <NavRow
              icon={UsersIcon}
              tone="sky"
              label="Клиенты"
              active={isActive("clients")}
              onClick={() => handleNav("clients")}
            />
            <NavRow
              icon={MessageSquare}
              tone="emerald"
              label="Чаты"
              badge={unreadChats > 0 ? unreadChats : undefined}
              active={isActive("chats")}
              onClick={() => handleNav("chats")}
            />
            <NavRow
              icon={Wallet}
              tone="amber"
              label="Финансы"
              active={isActive("finances")}
              onClick={() => handleNav("finances")}
            />
            <NavRow
              icon={RotateCcw}
              tone="rose"
              label="Напоминания"
              badge={recurringDue > 0 ? recurringDue : undefined}
              active={isActive("recurring")}
              onClick={() => handleNav("recurring")}
            />
            <NavRow
              icon={SettingsIcon}
              tone="slate"
              label="Настройки"
              active={isActive("settings")}
              onClick={() => handleNav("settings")}
            />
          </Group>

          <button
            type="button"
            onClick={toggleExpanded}
            className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] active:text-[var(--label)] transition"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <span className="flex-1 text-left">
              {expanded ? "Скрыть админ-раздел" : "Показать админ-раздел"}
            </span>
          </button>

          {expanded && (
            <Group>
              <NavRow
                icon={UsersIcon}
                tone="blue"
                label="Бригады"
                active={isActive("teams")}
                onClick={() => handleNav("teams")}
              />
              <NavRow
                icon={UserCircle2}
                tone="indigo"
                label="Мастера"
                active={isActive("masters")}
                onClick={() => handleNav("masters")}
              />
              <NavRow
                icon={Wrench}
                tone="orange"
                label="Услуги"
                active={isActive("services")}
                onClick={() => handleNav("services")}
              />
              <NavRow
                icon={MessageSquare}
                tone="mint"
                label="SMS-шаблоны"
                active={isActive("sms-templates")}
                onClick={() => handleNav("sms-templates")}
              />
            </Group>
          )}
        </nav>

        <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--separator)] bg-[var(--surface-card)]">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-[14px] text-[var(--system-red)] active:opacity-70 transition"
          >
            <LogOut size={16} strokeWidth={2} />
            Выход
          </button>
          <div className="text-[11px] text-[var(--label-tertiary)] mt-3 flex items-center gap-1 tabular-nums">
            <span>Синхр.</span>
            <SyncTime />
          </div>
          <div className="text-[10px] text-[var(--label-tertiary)] mt-1 font-mono tracking-wide">
            {BUILD_VERSION}
          </div>
        </div>
      </aside>
    </>
  );
}

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

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
      {children}
    </div>
  );
}

function NavRow({
  icon: Icon,
  tone,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: IconTone;
  label: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left min-h-[44px] transition-colors ${
        active ? "bg-[var(--accent-tint)]" : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <span
        className={`w-7 h-7 rounded-[7px] flex items-center justify-center text-white shrink-0 ${ICON_TONE_BG[tone]}`}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span
        className={`flex-1 truncate text-[15px] ${
          active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span className="min-w-[22px] h-[22px] px-1.5 bg-[var(--system-red)] rounded-full text-[12px] font-semibold text-white flex items-center justify-center tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}
