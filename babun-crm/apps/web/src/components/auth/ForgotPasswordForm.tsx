"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "./AuthCard";
import { requestPasswordReset } from "@/lib/supabase/auth-client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // We don't surface errors here — same response whether the email
    // exists or not. Avoids enumerating registered users.
    await requestPasswordReset(email, `${origin}/auth/callback?next=/reset-password`);
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthCard title="Проверь почту" subtitle="Если такой email есть — мы отправили ссылку">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-[14px] text-[var(--label-secondary)] leading-relaxed text-center">
          Открой ссылку из письма — перейдёшь на страницу нового пароля.
        </div>
        <Link
          href="/login"
          className="block text-center h-11 leading-[44px] mt-3 text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Назад ко входу
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Сброс пароля" subtitle="Введи email — пришлём ссылку">
      <form onSubmit={submit} className="space-y-3">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-4"
        >
          {loading ? "Отправляем…" : "Отправить ссылку"}
        </button>

        <Link
          href="/login"
          className="block text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Назад ко входу
        </Link>
      </form>
    </AuthCard>
  );
}
