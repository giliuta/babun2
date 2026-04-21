"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/backend-mode";

// Login / signup page.
//
// Modes:
//   * Supabase disabled (default) — stays the prototype stub: any
//     submit drops onto /dashboard/today. Keeps local-device flow
//     alive during the Supabase cutover.
//   * Supabase enabled — real email/password auth. A toggle lets
//     the user switch between "Войти" and "Регистрация"; the signup
//     trigger creates a tenant + owner row server-side, so no extra
//     round-trip is needed after signup.

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
      // Prototype fallback — keeps localStorage users unblocked until
      // the backend flips on.
      router.push("/dashboard/today");
      return;
    }

    try {
      const sb = getSupabase();
      if (mode === "signup") {
        const { error: err } = await sb.auth.signUp({ email, password });
        if (err) throw err;
        // Supabase defaults to email confirmation on. With it off
        // (see Supabase → Auth → Providers), the session is already
        // active and we can move straight to the app.
        router.push("/dashboard/today");
      } else {
        const { error: err } = await sb.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        router.push("/dashboard/today");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выполнить запрос"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">B</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Babun CRM</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {mode === "signin" ? "Войдите в систему" : "Создайте аккаунт"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@airfix.cy"
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
              minLength={8}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "signin"
                ? "Входим…"
                : "Создаём…"
              : mode === "signin"
                ? "Войти"
                : "Регистрация"}
          </button>

          {supabaseLive && (
            <button
              type="button"
              onClick={() =>
                setMode((m) => (m === "signin" ? "signup" : "signin"))
              }
              className="w-full text-center text-xs text-violet-600 active:text-violet-800"
            >
              {mode === "signin"
                ? "Нет аккаунта? Регистрация"
                : "Уже есть аккаунт? Войти"}
            </button>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          AirFix &copy; 2026 &mdash; Babun CRM
        </p>
      </div>
    </main>
  );
}
