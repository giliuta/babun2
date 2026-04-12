"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/app/dashboard/layout";
import { loadWaitlist } from "@/lib/waitlist";

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
  const isFinances = pathname.startsWith("/dashboard/finances");

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

  const openNew = () => {
    // If already on calendar, append the flag so the page effect fires.
    // Otherwise navigate there.
    if (pathname === "/dashboard") {
      router.replace("/dashboard?new=1");
    } else {
      router.push("/dashboard?new=1");
    }
  };

  return (
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
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <TabButton
          label="Клиенты"
          active={isClients}
          onClick={() => go("/dashboard/clients")}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />

        <TabButton
          label="Запись"
          active={false}
          onClick={openNew}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="12" y1="9" x2="12" y2="15" />
              <line x1="9" y1="12" x2="15" y2="12" />
            </svg>
          }
        />

        <TabButton
          label="Финансы"
          active={isFinances}
          onClick={() => go("/dashboard/finances")}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <TabButton
          label="Ещё"
          active={false}
          dot={pendingWaitlist > 0}
          onClick={sidebar.toggle}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          }
        />
      </div>
    </nav>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
  dot = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 min-w-[44px] h-[62px] flex flex-col items-center justify-center gap-1 transition ${
        active ? "text-stone-900" : "text-stone-400"
      }`}
    >
      <span className="relative">
        {icon}
        {dot && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 0 0 2px white",
            }}
          />
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
