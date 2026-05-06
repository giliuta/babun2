"use client";

// STORY-085 — Online booking settings form.
//
// Today: just the booking_slug field with a live preview of the
// public URL. Tomorrow: working hours, deposit toggle, confirmation
// text editor.

import { useState, useTransition } from "react";
import { Globe } from "@babun/shared/icons";
import { updateTenantBrand } from "@/app/dashboard/settings/account/brand-action";

interface Props {
  initialSlug: string | null;
}

export default function OnlineBookingForm({ initialSlug }: Props) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateTenantBrand({ booking_slug: slug });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Адрес страницы записи
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <label className="block">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-[var(--label-secondary)] shrink-0" />
            <span className="w-[80px] text-[12px] text-[var(--label-secondary)] shrink-0">
              Адрес
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="имя-латиницей"
              maxLength={32}
              className="flex-1 h-10 bg-[var(--fill-tertiary)] rounded-[10px] px-3 text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:ring-1 focus:ring-[var(--accent)] transition"
            />
          </div>
        </label>

        <div className="text-[11px] text-[var(--label-secondary)] leading-snug">
          Короткое имя для публичной ссылки. Латиница, цифры, дефис.
        </div>

        {slug && (
          <div className="rounded-[10px] bg-[var(--accent-tint)] px-3 py-2.5 text-[13px] font-mono text-[var(--accent)]">
            babun.app/book/{slug}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 mt-2 text-[12px] text-[var(--system-red)] leading-snug">
          {error}
        </div>
      )}

      <div className="px-1 mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="h-11 px-5 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          {isPending ? "Сохраняем…" : "Сохранить"}
        </button>
        {saved && (
          <span className="text-[12px] text-[var(--system-green)]">Сохранено ✓</span>
        )}
      </div>
    </div>
  );
}
