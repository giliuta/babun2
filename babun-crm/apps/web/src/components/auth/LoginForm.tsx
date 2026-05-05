"use client";

import Link from "next/link";
import AuthCard from "./AuthCard";
import AuthTabs from "./AuthTabs";
import SocialAuthButtons from "./SocialAuthButtons";

interface LoginFormProps {
  errorCode?: string | null;
  deleted?: boolean;
}

export default function LoginForm({
  errorCode = null,
  deleted = false,
}: LoginFormProps) {
  return (
    <AuthCard title="Babun CRM" subtitle="Войдите, чтобы продолжить">
      {deleted && (
        <div className="mb-4 rounded-[var(--radius-card)] bg-[rgba(52,199,89,0.10)] border border-[rgba(52,199,89,0.30)] p-3 text-[13px] leading-snug text-[var(--system-green,#34c759)]">
          Аккаунт удалён. Все данные стёрты.
        </div>
      )}
      {errorCode === "tenant_missing" && (
        <div className="mb-4 rounded-[var(--radius-card)] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.25)] p-3 text-[13px] leading-snug text-[var(--system-red)]">
          <div className="font-semibold mb-1">Аккаунт настроен неправильно</div>
          <div className="text-[var(--label-secondary)]">
            Напиши нам, починим вручную:{" "}
            <a
              href="mailto:airfix.cy@gmail.com?subject=Babun%3A%20tenant_missing"
              className="text-[var(--accent)] font-medium"
            >
              airfix.cy@gmail.com
            </a>
          </div>
        </div>
      )}
      {(errorCode === "link_expired" || errorCode === "link_invalid") && (
        <div className="mb-4 rounded-[var(--radius-card)] bg-[rgba(255,149,0,0.10)] border border-[rgba(255,149,0,0.30)] p-3 text-[13px] leading-snug text-[var(--system-orange,#ff9500)]">
          Ссылка истекла или уже использована. Запроси новую через{" "}
          <a href="/forgot-password" className="text-[var(--accent)] font-medium">
            «Забыли пароль?»
          </a>
        </div>
      )}

      <SocialAuthButtons variant="login" />

      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 h-px bg-[var(--separator)]" />
        <span className="text-[11px] uppercase tracking-wider text-[var(--label-tertiary)]">
          или
        </span>
        <div className="flex-1 h-px bg-[var(--separator)]" />
      </div>

      <AuthTabs variant="login" />

      <Link
        href="/register"
        className="block text-center h-11 leading-[44px] mt-3 text-[14px] font-medium text-[var(--accent)] active:opacity-60"
      >
        Нет аккаунта? Зарегистрироваться
      </Link>
    </AuthCard>
  );
}
