"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/app/dashboard/layout";

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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-end justify-around px-1 h-[60px] relative">
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

        {/* Centre action — larger, lifted */}
        <button
          type="button"
          onClick={openNew}
          aria-label="Новая запись"
          className="relative -top-3 flex flex-col items-center gap-0.5 min-w-[56px]"
        >
          <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-[10px] text-indigo-600 font-medium">Запись</span>
        </button>

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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-[44px] h-[60px] flex flex-col items-center justify-center gap-0.5 transition ${
        active ? "text-indigo-600" : "text-gray-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
