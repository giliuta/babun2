"use client";

import { useRouter } from "next/navigation";
import { useSidebar } from "@/app/dashboard/layout";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Show back arrow that navigates to /dashboard */
  showBack?: boolean;
  rightContent?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  rightContent,
}: PageHeaderProps) {
  const router = useRouter();
  const sidebar = useSidebar();

  return (
    <header className="flex-shrink-0 bg-indigo-700 lg:bg-white lg:border-b lg:border-gray-200 z-30">
      <div className="px-2 lg:px-4 py-2 lg:py-3 flex items-center gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Назад"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-indigo-600 shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label="Меню"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-indigo-600 shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base lg:text-lg font-semibold text-white lg:text-gray-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] lg:text-xs text-indigo-200 lg:text-gray-500 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {rightContent && <div className="flex items-center gap-1">{rightContent}</div>}
      </div>
    </header>
  );
}
