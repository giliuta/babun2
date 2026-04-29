"use client";

import { useState } from "react";
import { Lock, Check } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// STORY-041 G4 — Inline change-password form. Confirmation field
// guards against typos in the new password (which would brick the
// account until the user runs forgot-password). Min length matches
// LoginForm and Supabase's default policy (8).
export default function SecuritySection() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const canSubmit = pwd.length >= 8 && confirm === pwd && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error: err } = await supabase.auth.updateUser({ password: pwd });
      if (err) throw new Error(err.message);
      setPwd("");
      setConfirm("");
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пароль");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
        <Lock size={14} />
        <span>Безопасность</span>
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <Field label="Новый пароль">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Минимум 8 символов"
            autoComplete="new-password"
            minLength={8}
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
          {tooShort && (
            <div className="text-[12px] text-[var(--system-red)] mt-1">
              Минимум 8 символов
            </div>
          )}
        </Field>

        <Field label="Подтвердите">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повтори новый пароль"
            autoComplete="new-password"
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
          {mismatch && (
            <div className="text-[12px] text-[var(--system-red)] mt-1">
              Пароли не совпадают
            </div>
          )}
        </Field>

        {error && (
          <div className="text-[13px] text-[var(--system-red)] leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-40 transition flex items-center justify-center gap-2"
        >
          {savedAt ? (
            <>
              <Check size={16} />
              Пароль обновлён
            </>
          ) : saving ? (
            "Обновляем…"
          ) : (
            "Сменить пароль"
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
