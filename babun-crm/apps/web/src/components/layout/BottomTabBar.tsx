"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  MessageSquare,
  Wallet,
  UserCircle2,
} from "@babun/shared/icons";
import {
  useSidebar,
  useAppointments,
  useClients,
} from "@/components/layout/DashboardClientLayout";
import { loadChats, getTotalUnread } from "@babun/shared/local/chats";
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
    // Hydration-from-storage; legitimate external-state-sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // STORY-064 — tabs are sibling navigation, not a stack. Using
  // router.replace() means tapping between tabs doesn't accumulate
  // history, so iOS edge-swipe-back from a tab root has nothing to
  // go back to (no Clients→Calendar→Chats trail). Combined with the
  // wider EdgeGuard strips below, this gives the "full-page, no
  // swipe escape" feel the user expected.
  const go = (path: string) => {
    haptic("tap");
    router.replace(path);
  };

  // STORY-064 — prefetch sibling tabs on mount so tapping is
  // instant. Next 16's prefetch fetches the route's RSC payload +
  // shared chunks; subsequent navigation is fed from cache. Without
  // this, every tab tap triggers a fresh server roundtrip + JS
  // chunk load (the "долго думает" complaint).
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/dashboard/clients");
    router.prefetch("/dashboard/chats");
    router.prefetch("/dashboard/finances");
  }, [router]);

  return (
    <>
      <nav
        aria-label="Главная навигация"
        className="liquid-glass-bottom lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-around gap-0.5 px-2 h-[60px] pt-1">
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
            label="Кабинет"
            active={false}
            onClick={sidebar.toggle}
            icon={<UserCircle2 size={21} strokeWidth={2} />}
          />
        </div>
      </nav>
      {/* Spacer for the FAB and any fixed action bars on inner pages so
          they sit above the tab bar instead of overlapping it. */}

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

  // iOS Tabs / Telegram-iOS feel — flat icon stack.  Active tab tints
  // both icon and label to brand-blue and bumps font-weight.  No big
  // pill behind the icon — the user said the floating capsule looked
  // off (v319).  Press feedback is an accent-tint background.
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
      className={`relative flex-1 min-w-[44px] h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 press-scale ${
        active
          ? "text-[var(--accent)]"
          : "text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)]"
      }`}
      style={{
        transition:
          "color var(--dur-base) var(--ease-ios), background-color var(--dur-base) var(--ease-ios)",
      }}
    >
      <span
        className={`relative flex items-center justify-center ${
          active ? "animate-pill-hop" : ""
        }`}
      >
        {icon}
        {showCount && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--system-red)] text-[var(--label-on-accent)] text-[10px] font-semibold leading-[16px] text-center ring-2 ring-[var(--surface-card)]">
            {label9}
          </span>
        )}
      </span>
      <span
        className={`text-[10px] leading-none ${
          active ? "font-semibold" : "font-medium"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
