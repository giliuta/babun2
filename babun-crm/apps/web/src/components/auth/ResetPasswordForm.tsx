"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "./AuthCard";
import { updatePassword } from "@/lib/supabase/auth-client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 8) {
      setError("Минимум 8 символов");
      return;
    }
    setLoading(true);
    setError("");
    const { ok, error: err } = await updatePassword(password);
    if (!ok) {
      setError(err ?? "Не удалось обновить пароль");
      setLoading(false);
      return;
    }
    router.push("/dashboard/clients");
    router.refresh();
  };

  return (
    <AuthCard title="Новый пароль" subtitle="Минимум 8 символов">
      <form onSubmit={submit} className="space-y-3">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--separator)] shadow-[var(--shadow-card)]">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Новый пароль"
            required
            minLength={8}
            className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повтори пароль"
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
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-4"
        >
          {loading ? "Сохраняем…" : "Обновить пароль"}
        </button>
      </form>
    </AuthCard>
  );
}
