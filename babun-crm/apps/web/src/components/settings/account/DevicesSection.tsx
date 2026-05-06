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

export default function DevicesSection() {
  const [thisDeviceLabel, setThisDeviceLabel] = useState<string>("Это устройство");

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

  const handleSignOutOthers = async () => {
    if (!confirm("Выйти на всех устройствах кроме этого?")) return;
    try {
      const sb = getSupabaseBrowser();
      // Supabase signOut(scope: 'others') revokes all other sessions
      // for the current user. Current session stays alive.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.auth as any).signOut({ scope: "others" });
      alert("Готово. Все остальные устройства разлогинены.");
    } catch (err) {
      alert("Не удалось выйти: " + (err instanceof Error ? err.message : "ошибка"));
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
          onClick={handleSignOutOthers}
          className="w-full text-left px-4 py-3 text-[14px] text-[var(--system-red)] active:bg-[var(--fill-quaternary)]"
        >
          Выйти на всех других устройствах
        </button>
      </div>
      <div className="px-4 pt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
        Полный список активных сессий с датой и местом — в разработке. Подключим вместе с журналом входов.
      </div>
    </div>
  );
}
