"use client";

// STORY-077 — iOS-Settings-style profile hub navigation list.
//
// Apple-feel: a coloured profile card at the top, then a tappable
// list of grouped settings. Each row navigates to its own subpage so
// the hub itself stays a clean, single-screen overview.

import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  IdCard,
  Receipt,
  Shield,
  Sparkles,
} from "@babun/shared/icons";

interface Props {
  email: string;
  initials: string;
}

interface Row {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  title: string;
  hint?: string;
}

const ROWS: Row[] = [
  {
    href: "/dashboard/settings/account/personal",
    icon: <IdCard size={16} strokeWidth={2} />,
    iconBg: "bg-[#3478F6]",
    iconFg: "text-white",
    title: "Личная информация",
    hint: "Бизнес, регион, бренд, контакты",
  },
  {
    href: "/dashboard/settings/account/billing-info",
    icon: <Receipt size={16} strokeWidth={2} />,
    iconBg: "bg-[#34C759]",
    iconFg: "text-white",
    title: "Счёт компании",
    hint: "Реквизиты для инвойсов",
  },
  {
    href: "/dashboard/settings/account/security",
    icon: <Shield size={16} strokeWidth={2} />,
    iconBg: "bg-[#FF9500]",
    iconFg: "text-white",
    title: "Вход и безопасность",
    hint: "Пароль, 2FA, устройства",
  },
  {
    href: "/dashboard/settings/billing",
    icon: <CreditCard size={16} strokeWidth={2} />,
    iconBg: "bg-[#AF52DE]",
    iconFg: "text-white",
    title: "Тариф и оплата",
    hint: "Подписка, история платежей",
  },
];

export default function AccountNavList({ email, initials }: Props) {
  return (
    <div className="space-y-5">
      {/* Profile card */}
      <Link
        href="/dashboard/settings/account/personal"
        className="block bg-gradient-to-r from-[#3478F6] to-[#AF52DE] rounded-2xl shadow-[var(--shadow-card)] px-4 py-3 active:opacity-90 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white text-[var(--label)] flex items-center justify-center text-[18px] font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-white truncate">
              {email}
            </div>
            <div className="text-[12px] text-white/85 mt-0.5">
              Тапни, чтобы открыть профиль
            </div>
          </div>
          <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/95 text-[var(--label)] text-[12px] font-semibold shrink-0">
            Профиль
          </span>
        </div>
      </Link>

      {/* List */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        {ROWS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-center gap-3 px-4 h-[58px] active:bg-[var(--fill-quaternary)] transition"
          >
            <span
              className={`w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 ${r.iconBg} ${r.iconFg}`}
            >
              {r.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-[var(--label)] truncate">
                {r.title}
              </div>
              {r.hint && (
                <div className="text-[11px] text-[var(--label-secondary)] truncate leading-tight mt-0.5">
                  {r.hint}
                </div>
              )}
            </div>
            <ChevronRight
              size={16}
              className="text-[var(--label-tertiary)] shrink-0"
            />
          </Link>
        ))}
      </div>

      <div className="px-4 text-[11px] text-[var(--label-secondary)] flex items-center gap-1.5">
        <Sparkles size={12} />
        <span>Структура как в настройках Apple — каждая секция на своей странице.</span>
      </div>
    </div>
  );
}
