"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  MessageSquare,
  Wallet,
  Menu,
} from "lucide-react";
import {
  useSidebar,
  useAppointments,
  useClients,
} from "@/app/dashboard/layout";
import { loadChats, getTotalUnread } from "@/lib/chats";
import GlobalSearch from "./GlobalSearch";

// Telegram-style bottom nav. Five tabs, each a vertical stack of
// icon + tiny label. Active tab sits inside an accent-tint pill that
// wraps the whole stack (the "pill around the active tab" you see
// in Telegram iOS). Inactive tabs are secondary-label grey.
// The "+" FAB was removed in Sprint 027-hotfix — create flows start
// from the calendar grid or from Ещё → создать.

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebar = useSidebar();

  const isCalendar = pathname === "/dashboard";
  const isClients = pathname.startsWith("/dashboard/clients");
  const isChats = pathname.startsWith("/dashboard/chats");
  const isFinances = pathname.startsWith("/dashboard/finances");

  const [unreadChats, setUnreadChats] = useState(0);
  useEffect(() => {
    setUnreadChats(getTotalUnread(loadChats()));
  }, [pathname]);

  const [searchOpen, setSearchOpen] = useState(false);
  const { appointments } = useAppointments();
  const { clients } = useClients();

  // Open GlobalSearch via Cmd+K / Ctrl+K from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    router.push(path);
  };

  return (
    <>
      <nav
        aria-label="Главная навигация"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)] border-t border-[var(--separator)]"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-end justify-around px-2 h-[58px] pt-1 pb-1">
          <TabButton
            label="Календарь"
            active={isCalendar}
            onClick={() => go("/dashboard")}
            onLongPress={() => setSearchOpen(true)}
            icon={<CalendarIcon size={22} strokeWidth={2} />}
          />
          <TabButton
            label="Клиенты"
            active={isClients}
            onClick={() => go("/dashboard/clients")}
            icon={<UsersIcon size={22} strokeWidth={2} />}
          />
          <TabButton
            label="Чаты"
            active={isChats}
            count={unreadChats}
            onClick={() => go("/dashboard/chats")}
            icon={<MessageSquare size={22} strokeWidth={2} />}
          />
          <TabButton
            label="Финансы"
            active={isFinances}
            onClick={() => go("/dashboard/finances")}
            icon={<Wallet size={22} strokeWidth={2} />}
          />
          <TabButton
            label="Ещё"
            active={false}
            onClick={sidebar.toggle}
            icon={<Menu size={22} strokeWidth={2} />}
          />
        </div>
      </nav>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        clients={clients}
        appointments={appointments}
      />
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
  onLongPress,
  icon,
  dot = false,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  icon: React.ReactNode;
  dot?: boolean;
  count?: number;
}) {
  const showCount = typeof count === "number" && count > 0;
  const label9 = showCount && count > 9 ? "9+" : String(count ?? "");

  // Long-press matches the 500 ms threshold used elsewhere (calendar
  // long-press, etc.). Suppresses the click if long-press fired so
  // we don't navigate AND open search.
  const longPressFiredRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startLongPress = () => {
    if (!onLongPress) return;
    longPressFiredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, 500);
  };
  const cancelLongPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressFiredRef.current) return;
        onClick();
      }}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
      className={`relative flex-1 min-w-[44px] h-[50px] rounded-[var(--radius-pill)] flex flex-col items-center justify-center gap-0.5 transition active:scale-[0.97] ${
        active
          ? "bg-[var(--accent-tint)] text-[var(--accent)]"
          : "text-[var(--label-secondary)]"
      }`}
    >
      <span className="relative">
        {icon}
        {showCount && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--system-red)] text-[var(--label-on-accent)] text-[10px] font-semibold leading-[16px] text-center ring-2 ring-[var(--surface-card)]">
            {label9}
          </span>
        )}
        {!showCount && dot && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--system-red)] ring-2 ring-[var(--surface-card)]" />
        )}
      </span>
      <span
        className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}
      >
        {label}
      </span>
    </button>
  );
}
