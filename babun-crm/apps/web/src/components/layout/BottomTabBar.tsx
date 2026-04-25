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
import { haptic } from "@/lib/haptics";
import GlobalSearch from "./GlobalSearch";

// v319 — Telegram-iOS bottom bar.
//
// Container is a floating Liquid-Glass capsule (rounded-full) sitting
// 8 px above the home indicator with a soft drop shadow.  Active tab
// gets an accent-coloured circular pill behind the icon, plus the
// label is hidden on active to give that tab room to breathe — the
// rest stay icon+label.  Spring entrance animation when switching.

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
    haptic("tap");
    router.push(path);
  };

  return (
    <>
      <nav
        aria-label="Главная навигация"
        className="lg:hidden fixed left-0 right-0 z-40 flex justify-center px-3 pointer-events-none"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 6px)",
        }}
      >
        <div
          className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow:
              "0 8px 28px -10px rgba(15, 23, 42, 0.25), 0 0 0 0.5px rgba(15, 23, 42, 0.06)",
          }}
        >
          <TabButton
            label="Календарь"
            active={isCalendar}
            onClick={() => go("/dashboard")}
            onLongPress={() => setSearchOpen(true)}
            icon={<CalendarIcon size={20} strokeWidth={2.2} />}
          />
          <TabButton
            label="Клиенты"
            active={isClients}
            onClick={() => go("/dashboard/clients")}
            icon={<UsersIcon size={20} strokeWidth={2.2} />}
          />
          <TabButton
            label="Чаты"
            active={isChats}
            count={unreadChats}
            onClick={() => go("/dashboard/chats")}
            icon={<MessageSquare size={20} strokeWidth={2.2} />}
          />
          <TabButton
            label="Финансы"
            active={isFinances}
            onClick={() => go("/dashboard/finances")}
            icon={<Wallet size={20} strokeWidth={2.2} />}
          />
          <TabButton
            label="Ещё"
            active={false}
            onClick={sidebar.toggle}
            icon={<Menu size={20} strokeWidth={2.2} />}
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
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  icon: React.ReactNode;
  count?: number;
}) {
  const showCount = typeof count === "number" && count > 0;
  const label9 = showCount && count! > 9 ? "9+" : String(count ?? "");

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

  // Active = a 38×38 round accent pill behind the icon (spring entrance
  // via animate-pill-hop).  The label stays under the icon in accent
  // colour.  Inactive tabs are plain icon+grey label.  Mirrors the
  // Telegram iOS dock the user pointed at.
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
      aria-label={label}
      aria-pressed={active}
      className="relative h-12 px-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 press-scale active:bg-[var(--fill-tertiary)]"
      style={{ minWidth: 56 }}
    >
      <span
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          active
            ? "bg-[var(--accent)] text-[var(--label-on-accent)] animate-pill-hop"
            : "text-[var(--label-secondary)]"
        }`}
        style={{
          transition:
            "background-color var(--dur-base) var(--ease-ios), color var(--dur-base) var(--ease-ios)",
        }}
      >
        {icon}
        {showCount && (
          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--system-red)] text-[var(--label-on-accent)] text-[10px] font-semibold leading-[16px] text-center ring-2 ring-[var(--glass-bg,white)]">
            {label9}
          </span>
        )}
      </span>
      <span
        className={`text-[10px] leading-none font-semibold ${
          active ? "text-[var(--accent)]" : "text-[var(--label-secondary)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
