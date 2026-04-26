"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Telegram-style auth card. Stub form until STORY-037 wires real auth —
// any submit just routes to /dashboard.

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    router.push("/dashboard");
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
            <span className="text-[var(--label-on-accent)] text-[38px] font-bold">B</span>
          </div>
          <h1 className="text-[28px] font-bold text-[var(--label)] mt-5">
            Babun CRM
          </h1>
          <p className="text-[15px] text-[var(--label-secondary)] mt-1">
            Войдите, чтобы продолжить
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              required
              minLength={8}
              className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-4"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>

        <p className="text-center text-[12px] text-[var(--label-tertiary)] mt-10">
          AirFix &copy; 2026 · Babun CRM
        </p>
      </div>
    </main>
  );
}
