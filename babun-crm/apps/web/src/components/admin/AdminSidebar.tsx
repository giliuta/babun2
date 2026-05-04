"use client";

// STORY-070 — Admin sidebar (fixed-position on lg+, hidden on mobile
// for now — admin work is desktop-first). Same visual language as
// the tenant sidebar (STORY-064 — flat icons, accent on active).

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  LineChart,
  ChevronLeft,
} from "@babun/shared/icons";

const NAV: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
}> = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Тенанты", icon: Users },
  { href: "/admin/sms-senders", label: "Sender-заявки", icon: MessageSquare },
  { href: "/admin/billing", label: "Платежи", icon: CreditCard },
  { href: "/admin/stats", label: "Статистика", icon: LineChart },
];

export default function AdminSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <aside
      role="navigation"
      aria-label="Админ-навигация"
      className="hidden lg:flex fixed top-0 left-0 h-full w-[240px] bg-[var(--surface-card)] border-r border-[var(--separator)] flex-col z-40"
    >
      <div className="px-4 pt-5 pb-4 border-b border-[var(--separator)]">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-[15px] font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #1F66D7 0%, #1850A8 100%)",
            }}
          >
            B
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--label)] leading-tight">
              Babun · Admin
            </div>
            <div className="text-[11px] text-[var(--label-secondary)] truncate">
              {adminEmail}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 mx-1 my-0.5 rounded-[10px] min-h-[40px] transition-colors text-[14px] ${
                active
                  ? "bg-[var(--accent-tint)] text-[var(--accent)] font-semibold"
                  : "text-[var(--label)] font-medium active:bg-[var(--fill-quaternary)]"
              }`}
            >
              <Icon
                size={18}
                strokeWidth={2}
                className={
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--label-secondary)]"
                }
              />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--separator)]">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[13px] text-[var(--label-secondary)] active:text-[var(--label)] transition"
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
          Вернуться в кабинет
        </Link>
      </div>
    </aside>
  );
}
