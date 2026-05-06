"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "./AuthCard";
import SocialAuthButtons from "./SocialAuthButtons";
import { signUp } from "@/lib/supabase/auth-client";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { ok, error: err } = await signUp(
      email,
      password,
      businessName.trim() || undefined,
    );
    if (!ok) {
      setError(err ?? "Не удалось создать аккаунт");
      setLoading(false);
      return;
    }
    // If "Confirm email" is OFF in Supabase, signUp also auto-signs-in.
    // If it's ON, we land here without a session — show "check your email".
    const supabase = (await import("@/lib/supabase/client")).getSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setPending(true);
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <AuthCard title="Проверь почту" subtitle="Мы отправили ссылку для подтверждения">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-[14px] text-[var(--label-secondary)] leading-relaxed">
          На <span className="text-[var(--label)] font-medium">{email}</span>{" "}
          ушло письмо со ссылкой. Открой его, перейди по ссылке — и
          возвращайся сюда, чтобы войти.
        </div>
        <Link
          href="/login"
          className="block text-center h-11 leading-[44px] mt-3 text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Уже подтвердил? Войти
        </Link>
      </AuthCard>
    );
  }

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

      <form onSubmit={submit} className="space-y-3">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--separator)] shadow-[var(--shadow-card)]">
          <label className="block">
            <span className="sr-only">Название бизнеса</span>
            <input
              type="text"
              autoComplete="organization"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Название бизнеса (необязательно)"
              maxLength={120}
              aria-label="Название бизнеса"
              className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
            />
          </label>
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              aria-label="Email"
              className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
            />
          </label>
          <label className="block">
            <span className="sr-only">Пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль (минимум 8 символов)"
              required
              minLength={8}
              aria-label="Пароль"
              className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
            />
          </label>
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
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>

        <p className="text-[11px] text-[var(--label-secondary)] text-center leading-snug px-2">
          После регистрации мы отправим письмо со ссылкой подтверждения. Открой его — и возвращайся сюда, чтобы войти.
        </p>

        <Link
          href="/login"
          className="block text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Уже есть аккаунт? Войти
        </Link>
      </form>
    </AuthCard>
  );
}
