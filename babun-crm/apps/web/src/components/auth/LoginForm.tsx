"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "./AuthCard";
import SocialAuthButtons from "./SocialAuthButtons";
import { signIn } from "@/lib/supabase/auth-client";

interface LoginFormProps {
  errorCode?: string | null;
  deleted?: boolean;
}

export default function LoginForm({
  errorCode = null,
  deleted = false,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { ok, error: err } = await signIn(email, password);
    if (!ok) {
      setError(err ?? "Не удалось войти");
      setLoading(false);
      return;
    }
    router.push("/dashboard/clients");
    router.refresh();
  };

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

      <form onSubmit={submit} className="space-y-3">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--separator)] shadow-[var(--shadow-card)]">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            minLength={8}
            className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
        </div>

        {error && (
          <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-2"
        >
          {loading ? "Входим…" : "Войти"}
        </button>

        <Link
          href="/forgot-password"
          className="block text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Забыли пароль?
        </Link>

        <Link
          href="/register"
          className="block text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Нет аккаунта? Зарегистрироваться
        </Link>
      </form>
    </AuthCard>
  );
}
