"use client";

// STORY-060 §F3.3 — one-shot prompt that helps legacy prototype-phase
// users replace the hardcoded "Тестовый Салон Babun" localStorage value
// with their real business name. Once Babun graduated from localStorage-
// only to a Supabase-backed tenants table, the source of truth moved to
// `tenants.name`, but a handful of users still carry the prototype
// marker in `babun-tenant-name`. We surface it only when:
//
//   • localStorage `babun-tenant-name` === "Тестовый Салон Babun"
//   • there are 0 appointments yet (true demo / fresh install)
//   • the user hasn't already dismissed this prompt
//
// All three gates must hold; otherwise we render nothing. The prompt
// writes the new name back through `setTenantName` (localStorage) AND
// best-effort forwards it to the active `TenantContext` consumer via a
// custom event — wiring the context update itself is left to the
// mounting layer so this component stays self-contained.

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";
import { getStorage } from "@babun/shared/storage";
import { useAppointments } from "@/components/layout/DashboardClientLayout";

const TENANT_NAME_KEY = "babun-tenant-name";
const LEGACY_PLACEHOLDER = "Тестовый Салон Babun";
const DISMISS_KEY = "babun:tenant-name-migration-dismissed";

/** Read the legacy localStorage tenant name, trimmed. Empty string when missing. */
export function readLocalTenantName(): string {
  return getStorage().getRaw(TENANT_NAME_KEY)?.trim() ?? "";
}

/** Persist a new tenant name into the legacy localStorage slot. Trims the
 *  value to match `readLocalTenantName`. No-ops on empty input. */
export function setTenantName(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  getStorage().setRaw(TENANT_NAME_KEY, trimmed);
}

export function TenantNameMigrationPrompt(): React.ReactElement | null {
  const { appointments } = useAppointments();
  // `null` = haven't decided yet (SSR / pre-mount). `true`/`false` after
  // the gate effect runs. Keeping it tri-state avoids a flash of the
  // dialog during hydration when localStorage hasn't been read yet.
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = getStorage();
    const current = storage.getRaw(TENANT_NAME_KEY)?.trim() ?? "";
    const dismissed = storage.getRaw(DISMISS_KEY) === "1";
    const isLegacy = current === LEGACY_PLACEHOLDER;
    const noData = appointments.length === 0;
    setShouldShow(isLegacy && noData && !dismissed);
  }, [appointments.length]);

  if (shouldShow !== true) return null;

  const handleDismiss = (): void => {
    getStorage().setRaw(DISMISS_KEY, "1");
    setShouldShow(false);
  };

  const handleSave = (): void => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      setTenantName(trimmed);
      getStorage().setRaw(DISMISS_KEY, "1");
      // Best-effort notify any TenantContext consumer that the local
      // mirror just changed. The mounting layer can listen for this
      // event and refresh its provider value. We deliberately don't
      // hard-import a context setter here — keeps the component
      // decoupled from the layout module's internals.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("babun:tenant-name-changed", { detail: { name: trimmed } }),
        );
      }
    } finally {
      setBusy(false);
      setShouldShow(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-migration-title"
      onClick={handleDismiss}
    >
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2
            id="tenant-migration-title"
            className="text-[18px] font-semibold text-[var(--label)]"
          >
            Как называется ваш бизнес?
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Закрыть"
            className="w-8 h-8 -mr-2 -mt-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Замените тестовое название на настоящее — оно будет видно в
          SMS-уведомлениях, PDF-документах и шапке приложения.
        </p>

        <input
          type="text"
          autoComplete="organization"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Например, AirFix"
          className="w-full h-12 px-4 text-[16px] bg-[var(--fill-tertiary)] rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border focus:border-[var(--accent)] transition"
          autoFocus
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] transition"
          >
            Позже
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={value.trim().length === 0 || busy}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:scale-[0.98] transition"
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
