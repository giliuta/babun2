"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Hydration-from-storage pattern, same as usePwaInstallState /
// OfflineIndicator / SplashScreen — the lint rule wants subscriptions
// only, but reading sessionStorage on mount and surfacing visibility
// is the legitimate exception.

// STORY-059 — CSV import hint banner.
//
// Shown on /dashboard/clients when the tenant has between 1 and 4
// clients. Below 1, the prominent first-run empty state covers the
// "no clients yet" case. At 5+ the user is past the cold-start phase
// and the hint adds noise. Dismissible — flag persists in
// localStorage so a returning user doesn't see it again on the same
// device.
//
// PWA-aware: storage failures (private mode, quota) silently no-op
// the dismiss, which is acceptable — re-showing the banner once is
// less bad than crashing on save.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Upload, X } from "@babun/shared/icons";
import { getStorage } from "@babun/shared/storage";

const DISMISS_KEY = "babun:hint-csv-import-dismissed";

interface Props {
  /** Current tenant client count. Component renders nothing outside
   *  the [1, 4] band. */
  clientsCount: number;
}

export function CsvImportHint({ clientsCount }: Props) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (clientsCount < 1 || clientsCount >= 5) {
      setHidden(true);
      return;
    }
    let dismissed = false;
    try {
      dismissed = getStorage().getRaw(DISMISS_KEY) === "1";
    } catch {
      // private mode — show the hint once, accept re-show after reload.
    }
    setHidden(dismissed);
  }, [clientsCount]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      getStorage().setRaw(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setHidden(true);
  };

  return (
    <div className="mx-3 mt-3 px-3 py-2.5 rounded-[12px] bg-[var(--accent-tint)] border border-[var(--accent)]/15 flex items-start gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-[8px] bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center">
        <Upload size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        {/* Brief 3 #5: don't promise an importer that doesn't exist
            yet. The /clients/import target is currently a "coming
            soon" stub (STORY-046, parked). Banner copy now sets the
            right expectation — teaser, not active CTA — until the
            real importer lands. */}
        <div className="text-[14px] font-semibold text-[var(--label)] leading-snug">
          Импорт из CSV — в работе
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
          Загрузка базы клиентов одним файлом скоро появится. Пока добавляйте вручную.
        </div>
        <Link
          href="/dashboard/clients/import"
          className="inline-block mt-1.5 text-[13px] font-semibold text-[var(--accent)] active:opacity-70 transition"
        >
          Подробнее →
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть подсказку"
        className="flex-shrink-0 w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] transition"
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
