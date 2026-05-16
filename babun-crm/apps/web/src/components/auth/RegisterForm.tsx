"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "./AuthCard";
import SocialAuthButtons from "./SocialAuthButtons";
import { signUp } from "@/lib/supabase/auth-client";

export default function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // v520 §3.1 — explicit Terms / Privacy acknowledgement before
  // signing up. Submit stays disabled until the user checks the box.
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const canSubmit =
    agreed &&
    !loading &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    // v520 §3.1 — «Название бизнеса» field dropped from this form
    // (the onboarding wizard asks for it on Step 1, where it lives
    // alongside the vertical / calendar-mode choices). Passing the
    // user's full name through signUp instead so the welcome
    // greeting can be personal.
    const { ok, error: err } = await signUp(
      email,
      password,
      fullName.trim() || undefined,
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
      <AuthCard title="Проверьте почту" subtitle="Мы отправили ссылку для подтверждения">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-[14px] text-[var(--label-secondary)] leading-relaxed">
          На <span className="text-[var(--label)] font-medium">{email}</span>{" "}
          ушло письмо со ссылкой. Откройте его, перейдите по ссылке — и
          возвращайтесь сюда, чтобы войти.
        </div>
        <Link
          href="/login"
          className="block text-center h-11 leading-[44px] mt-3 text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Уже подтвердили? Войти
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
            <span className="sr-only">Ваше имя</span>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ваше имя"
              required
              maxLength={120}
              aria-label="Ваше имя"
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

        {/* v520 §3.1 — Terms / Privacy ack. Required to enable the
            submit. Links open in new tabs so the user doesn't lose
            the half-filled form on accidental navigation. */}
        <label className="flex items-start gap-2.5 px-1 py-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            aria-label="Согласие с условиями и политикой конфиденциальности"
            className="mt-[3px] w-4 h-4 accent-[var(--accent)] cursor-pointer"
          />
          <span className="text-[12px] text-[var(--label-secondary)] leading-snug">
            Я согласен(на) с{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline"
            >
              Условиями
            </Link>{" "}
            и{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline"
            >
              Политикой конфиденциальности
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition mt-2"
          title={
            !agreed
              ? "Подтвердите согласие с Условиями"
              : password.length < 8
                ? "Пароль минимум 8 символов"
                : ""
          }
        >
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>

        <p className="text-[11px] text-[var(--label-secondary)] text-center leading-snug px-2">
          После регистрации мы отправим письмо со ссылкой подтверждения. Откройте его — и возвращайтесь сюда, чтобы войти.
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
