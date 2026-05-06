"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "@babun/shared/icons";
import { signOut } from "@/lib/supabase/auth-client";

const CONFIRM_WORD = "УДАЛИТЬ";

// STORY-041 G4 — Account self-delete. Modal forces typed confirmation
// (CONFIRM_WORD) before the destructive action runs. The actual
// cascade lives in /api/account/delete (server-only, uses service
// role to drop auth.users after RLS-scoped DELETEs of tenant data).
export default function DangerZoneSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = typed.trim() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Best-effort sign-out so the cookie is gone before the redirect.
      // If the server already invalidated the user the call may error;
      // we ignore that — the redirect is what matters.
      try {
        await signOut();
      } catch {
        // ignore
      }
      router.push("/login?deleted=true");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить аккаунт");
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--system-red)] uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>Опасная зона</span>
        </div>
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[rgba(255,59,48,0.30)] shadow-[var(--shadow-card)] p-4 space-y-3">
          <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
            Удаление аккаунта необратимо. Будут стёрты все клиенты, заметки и
            настройки.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTyped("");
              setError(null);
            }}
            className="w-full h-11 rounded-[10px] bg-[rgba(255,59,48,0.10)] border border-[rgba(255,59,48,0.30)] text-[var(--system-red)] text-[15px] font-semibold active:bg-[rgba(255,59,48,0.18)] active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Удалить аккаунт
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--system-red)]">
              <AlertTriangle size={20} />
              <h2 className="text-[17px] font-semibold">Удалить аккаунт?</h2>
            </div>
            <p className="text-[14px] text-[var(--label-secondary)] leading-snug">
              Это удалит ваш аккаунт навсегда. Все данные (клиенты, заметки,
              настройки) будут потеряны.
            </p>
            <label className="block">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
                Введите «{CONFIRM_WORD}» для подтверждения
              </div>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                disabled={busy}
                className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--system-red)] transition"
              />
            </label>

            {error && (
              <div className="text-[13px] text-[var(--system-red)] leading-snug">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!ready || busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--system-red)] text-white text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:scale-[0.98] transition"
              >
                {busy ? "Удаляем…" : "Удалить аккаунт"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
