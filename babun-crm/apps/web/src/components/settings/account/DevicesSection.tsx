"use client";

// STORY-077 — Connected devices placeholder.
//
// Telegram-style "current device on top + active sessions list +
// sign-out-from-all" UX is the target. Real implementation needs
// auth.audit_log_entries reads + a dedicated revoke-session RPC.
// Until that ships we render a single row showing the current
// session — which is the most-asked piece of info — and a
// 'Скоро' pill for the rest.

import { Monitor } from "@babun/shared/icons";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function DevicesSection() {
  const [thisDeviceLabel, setThisDeviceLabel] = useState<string>("Это устройство");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    let device = "Это устройство";
    if (/iPhone|iPad/i.test(ua)) device = "iPhone";
    else if (/Android/i.test(ua)) device = "Android";
    else if (/Mac/i.test(ua)) device = "Mac";
    else if (/Windows/i.test(ua)) device = "Windows";
    else if (/Linux/i.test(ua)) device = "Linux";
    setThisDeviceLabel(device);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSignOutOthers = async () => {
    setShowConfirm(false);
    try {
      const sb = getSupabaseBrowser();
      // Supabase signOut(scope: 'others') revokes all other sessions
      // for the current user. Current session stays alive.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.auth as any).signOut({ scope: "others" });
      setToast({ kind: "ok", text: "Готово. Все остальные устройства разлогинены." });
    } catch (err) {
      setToast({
        kind: "err",
        text: "Не удалось выйти: " + (err instanceof Error ? err.message : "ошибка"),
      });
    }
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Устройства
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Monitor size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-[var(--label)]">
              {thisDeviceLabel}
            </div>
            <div className="text-[11px] text-[var(--label-secondary)] mt-0.5">
              Это устройство · в сети
            </div>
          </div>
          <span className="inline-flex items-center h-6 px-2 rounded-full bg-[var(--accent-tint)] text-[10px] uppercase tracking-wider font-bold text-[var(--accent)]">
            Текущее
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="w-full text-left px-4 py-3 text-[14px] text-[var(--system-red)] active:bg-[var(--fill-quaternary)] min-h-[44px]"
        >
          Выйти на всех других устройствах
        </button>
      </div>
      <div className="px-4 pt-2 text-[11px] text-[var(--label-secondary)] leading-snug">
        Полный список активных сессий с датой и местом — в разработке. Подключим вместе с журналом входов.
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Выйти везде кроме этого?"
          message="Все остальные устройства будут разлогинены. Это устройство останется в сети."
          confirmLabel="Выйти"
          cancelLabel="Отмена"
          danger
          onConfirm={handleSignOutOthers}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[95] px-4 py-2 rounded-full shadow-lg text-[13px] font-medium ${
            toast.kind === "ok"
              ? "bg-[var(--system-green)] text-white"
              : "bg-[var(--system-red)] text-white"
          }`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
