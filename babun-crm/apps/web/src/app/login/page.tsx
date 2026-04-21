"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/backend-mode";

// Telegram-style auth card (Sprint 031). Accent-blue Babun bubble
// at the top, 28-px title, grouped two-field input card, 50-px
// pill primary CTA, ghost toggle when Supabase is live. Plays
// nicely from iPhone SE (375 × 812) up to tablet widths.

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabaseLive = isSupabaseEnabled() && hasSupabaseEnv();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabaseLive) {
      router.push("/dashboard");
      return;
    }

    try {
      const sb = getSupabase();
      if (mode === "signup") {
        const { error: err } = await sb.auth.signUp({ email, password });
        if (err) throw err;
        router.push("/dashboard");
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить запрос");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-start justify-center p-5 pt-16 bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 64px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-[var(--accent)] rounded-[22px] flex items-center justify-center shadow-[0_20px_40px_-15px_rgba(62,136,247,0.5)]">
            <span className="text-white text-[38px] font-bold">B</span>
          </div>
          <h1 className="text-[28px] font-bold text-[var(--label)] mt-5">
            Babun CRM
          </h1>
          <p className="text-[15px] text-[var(--label-secondary)] mt-1">
            {mode === "signin" ? "Войдите, чтобы продолжить" : "Создайте учётную запись"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--separator)] shadow-[var(--shadow-card)]">
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
            />
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
            className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-white text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-4"
          >
            {loading
              ? mode === "signin"
                ? "Входим…"
                : "Создаём…"
              : mode === "signin"
                ? "Войти"
                : "Создать аккаунт"}
          </button>

          {supabaseLive && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              className="w-full h-11 text-[14px] font-medium text-[var(--accent)] active:opacity-60 transition"
            >
              {mode === "signin"
                ? "Нет аккаунта? Зарегистрироваться"
                : "Уже есть аккаунт? Войти"}
            </button>
          )}
        </form>

        <p className="text-center text-[11px] text-[var(--label-tertiary)] mt-10">
          AirFix &copy; 2026 · Babun CRM
        </p>
      </div>
    </main>
  );
}
