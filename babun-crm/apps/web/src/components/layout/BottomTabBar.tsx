"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  MessageSquare,
  Wallet,
  Menu,
  Plus,
} from "lucide-react";
import { useSidebar } from "@/app/dashboard/layout";
import { loadWaitlist } from "@/lib/waitlist";
import { loadChats, getTotalUnread } from "@/lib/chats";
import CreateMenu from "./CreateMenu";

// Bottom tab bar — visible on mobile only (lg:hidden). The layout adds
// padding-bottom so the bar never covers content. The centre "+ Запись"
// pill navigates to /dashboard and sets a ?new=1 query param which the
// calendar page picks up and opens the inline create sheet.

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebar = useSidebar();

  const isCalendar = pathname === "/dashboard";
  const isClients = pathname.startsWith("/dashboard/clients");
  const isChats = pathname.startsWith("/dashboard/chats");
  const isFinances =
    pathname.startsWith("/dashboard/finances") ||
    pathname.startsWith("/dashboard/expenses") ||
    pathname.startsWith("/dashboard/payroll") ||
    pathname.startsWith("/dashboard/reports");

  const [unreadChats, setUnreadChats] = useState(0);
  useEffect(() => {
    setUnreadChats(getTotalUnread(loadChats()));
  }, [pathname]);

  const [createOpen, setCreateOpen] = useState(false);

  // Unread waitlist — shows a red dot on the "Ещё" tab while any
  // entry is still pending, so the dispatcher knows there's something
  // to deal with without opening the drawer.
  const [pendingWaitlist, setPendingWaitlist] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setPendingWaitlist(
        loadWaitlist().filter((i) => i.status === "pending").length
      );
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  const go = (path: string) => {
    router.push(path);
  };

  return (
    <>
      <nav
        aria-label="Главная навигация"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-surface"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -8px 32px -12px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div className="flex items-end justify-around px-1 h-[62px] relative">
          <TabButton
            label="Календарь"
            active={isCalendar}
            onClick={() => go("/dashboard")}
            icon={<CalendarIcon size={24} strokeWidth={2} />}
          />
          <TabButton
            label="Клиенты"
            active={isClients}
            onClick={() => go("/dashboard/clients")}
            icon={<UsersIcon size={24} strokeWidth={2} />}
          />

          {/* Center FAB "+" — primary write-path. Sits above the tab-bar
              centerline so the thumb always finds it. Opens CreateMenu
              below (centred popup, per product rule). */}
          <button
            type="button"
            aria-label="Создать"
            onClick={() => setCreateOpen(true)}
            className="relative -top-4 w-14 h-14 rounded-full bg-violet-600 text-white shadow-[0_10px_25px_-10px_rgba(124,58,237,0.6)] flex items-center justify-center active:scale-[0.94] transition"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>

          <TabButton
            label="Чаты"
            active={isChats}
            count={unreadChats}
            onClick={() => go("/dashboard/chats")}
            icon={<MessageSquare size={24} strokeWidth={2} />}
          />

          <TabButton
            label="Финансы"
            active={isFinances}
            onClick={() => go("/dashboard/finances")}
            icon={<Wallet size={24} strokeWidth={2} />}
          />
          <TabButton
            label="Ещё"
            active={false}
            dot={pendingWaitlist > 0}
            onClick={sidebar.toggle}
            icon={<Menu size={24} strokeWidth={2} />}
          />
        </div>
      </nav>

      <CreateMenu
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreateAppointment={() => router.push("/dashboard?new=1&kind=work")}
        onCreateExpense={() => router.push("/dashboard?new=1&kind=expense")}
        onCreateEvent={() => router.push("/dashboard?new=1&kind=event")}
        onCreateLead={() => router.push("/dashboard/chats")}
      />
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
  dot = false,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  dot?: boolean;
  count?: number;
}) {
  const showCount = typeof count === "number" && count > 0;
  const label9 = showCount && count > 9 ? "9+" : String(count ?? "");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 min-w-[44px] h-[62px] flex flex-col items-center justify-center gap-1 transition active:scale-[0.97] ${
        active ? "text-violet-600" : "text-slate-500"
      }`}
    >
      <span className="relative">
        {icon}
        {showCount && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-[16px] text-center ring-2 ring-white">
            {label9}
          </span>
        )}
        {!showCount && dot && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
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
