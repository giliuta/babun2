"use client";

import { ChevronLeft, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/app/dashboard/layout";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Show back arrow that navigates to `backHref`. */
  showBack?: boolean;
  /**
   * Override the back-button destination. Default is `/dashboard`.
   * Settings sub-pages should pass `/dashboard/settings` so back goes
   * to the settings menu, not the calendar.
   */
  backHref?: string;
  /** Custom left slot — replaces the default back/menu button. */
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

// iOS UINavigationBar — 44 pt nav, 17 pt semibold centred title with
// optional 11 pt subtitle under it. Brand-violet on mobile (matches
// the calendar header so the two chain together), white on desktop
// (iPad / web). Back chevron uses the lucide glyph instead of an
// inline SVG — keeps icon weights consistent across the app.
export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  backHref = "/dashboard",
  leftContent,
  rightContent,
}: PageHeaderProps) {
  const router = useRouter();
  const sidebar = useSidebar();

  return (
    <header className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] z-30">
      <div className="px-2 lg:px-4 min-h-[44px] flex items-center gap-1">
        {leftContent ? (
          <div className="shrink-0">{leftContent}</div>
        ) : showBack ? (
          <button
            type="button"
            onClick={() => router.push(backHref)}
            aria-label="Назад"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] shrink-0 transition"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label="Меню"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] shrink-0 transition"
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        )}

        <div className="flex-1 min-w-0 py-2 text-center lg:text-left">
          <h1 className="text-[17px] font-semibold text-[var(--label)] truncate tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] text-[var(--label-secondary)] truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {rightContent && (
          <div className="flex items-center gap-1 flex-shrink-0">{rightContent}</div>
        )}
      </div>
    </header>
  );
}
