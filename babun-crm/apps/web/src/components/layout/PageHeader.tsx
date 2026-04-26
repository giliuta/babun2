"use client";

import { ChevronDown, ChevronLeft, Menu } from "@babun/shared/icons";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/app/dashboard/layout";
import { haptic } from "@/lib/haptics";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Show back arrow that navigates back. */
  showBack?: boolean;
  /**
   * Override the back-button destination.  When omitted (default) the
   * arrow does `router.back()` — which is the natural iOS behaviour
   * (whichever screen brought you here is where you go).  Pass a
   * specific path only when you want to force a different parent
   * (e.g. a deep-link landing page that has no real history).
   */
  backHref?: string;
  /** Custom left slot — replaces the default back/menu button. */
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  /** When set, the title becomes a tap target (e.g. opens sort sheet).
   *  Adds a subtle chevron-down to hint at interactivity. */
  onTitleClick?: () => void;
}

// Telegram-style navigation bar. 44 pt nav height, 17 pt semibold
// centered title + optional 12 pt subtitle. Leading button is a
// 40 pt fill-primary circle (back chevron accent-blue, menu icon
// secondary-label grey). Lives on every non-calendar screen.
export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  backHref,
  leftContent,
  rightContent,
  onTitleClick,
}: PageHeaderProps) {
  const router = useRouter();
  const sidebar = useSidebar();

  // v319 — Smart back behavior.  iOS native pattern: arrow returns
  // to whichever screen pushed you here.  Falls back to `backHref`
  // (or /dashboard) when there is no history (cold deep-link).
  const goBack = () => {
    haptic("light");
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <header className="liquid-glass flex-shrink-0 z-30">
      <div className="px-3 lg:px-4 min-h-[44px] flex items-center gap-2">
        {leftContent ? (
          <div className="shrink-0">{leftContent}</div>
        ) : showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Назад"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-tertiary)] shrink-0 transition press-scale"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label="Меню"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)] shrink-0 transition press-scale"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
        )}

        <div className="flex-1 min-w-0 py-2 text-center lg:text-left">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className="inline-flex items-center gap-1 text-[17px] font-semibold text-[var(--label)] truncate leading-tight active:opacity-70 transition"
            >
              <span className="truncate">{title}</span>
              <ChevronDown
                size={15}
                strokeWidth={2.5}
                className="text-[var(--label-tertiary)] shrink-0"
              />
            </button>
          ) : (
            <h1 className="text-[17px] font-semibold text-[var(--label)] truncate leading-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-[12px] text-[var(--label-secondary)] truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {rightContent && (
          <div className="flex items-center gap-2 flex-shrink-0">{rightContent}</div>
        )}
      </div>
    </header>
  );
}
