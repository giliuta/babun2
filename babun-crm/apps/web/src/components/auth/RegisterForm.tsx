"use client";

import Link from "next/link";
import AuthCard from "./AuthCard";
import AuthTabs from "./AuthTabs";
import SocialAuthButtons from "./SocialAuthButtons";

export default function RegisterForm() {
  return (
    <AuthCard title="Babun CRM" subtitle="Создайте аккаунт за 30 секунд">
      <SocialAuthButtons variant="register" />

      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 h-px bg-[var(--separator)]" />
        <span className="text-[11px] uppercase tracking-wider text-[var(--label-tertiary)]">
          или
        </span>
        <div className="flex-1 h-px bg-[var(--separator)]" />
      </div>

      <AuthTabs variant="register" />

      <Link
        href="/login"
        className="block text-center h-11 leading-[44px] mt-3 text-[14px] font-medium text-[var(--accent)] active:opacity-60"
      >
        Уже есть аккаунт? Войти
      </Link>
    </AuthCard>
  );
}
