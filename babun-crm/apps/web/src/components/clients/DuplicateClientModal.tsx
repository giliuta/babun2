// Duplicate-by-phone guard modal — Sprint clients-99 (F1.5).
//
// Surfaces when the new-client form tries to save a phone that
// already resolves to a live client (same tenant). Lets the operator
// either open the existing client or keep the duplicate (rare, but
// legit — twins sharing a phone, e.g.).

"use client";

import { useEffect } from "react";
import type { Client } from "@babun/shared/local/clients";
import { User, X } from "@babun/shared/icons";

interface Props {
  /** The existing live client we matched. */
  existing: Client;
  /** Phone (E.164) the user tried to save. */
  attemptedPhoneE164: string;
  /** Open the existing client (route + close modal). */
  onOpenExisting: () => void;
  /** Save anyway as a separate client. */
  onSaveAnyway: () => void;
  /** Just cancel — go back to editing the form. */
  onCancel: () => void;
}

export function DuplicateClientModal({
  existing,
  attemptedPhoneE164,
  onOpenExisting,
  onSaveAnyway,
  onCancel,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-modal-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[var(--surface-elevated)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full p-1 text-[var(--label-secondary)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <h2 id="dup-modal-title" className="pr-6 text-[18px] font-semibold tracking-tight text-[var(--label)]">
          Такой клиент уже есть
        </h2>

        <p className="mt-2 text-[14px] leading-snug text-[var(--label-secondary)]">
          Номер <span className="font-mono">{attemptedPhoneE164}</span> уже записан на:
        </p>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--surface-grouped)] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)]">
            <User size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium text-[var(--label)]">
              {existing.full_name || "Без имени"}
            </div>
            <div className="truncate text-[13px] text-[var(--label-secondary)]">
              {existing.phone || existing.phone_e164 || "—"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenExisting}
            className="h-11 rounded-xl bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
          >
            Открыть существующего
          </button>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="h-11 rounded-xl border border-[var(--separator)] bg-transparent text-[15px] font-medium text-[var(--label)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
          >
            Всё равно добавить как нового
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl text-[15px] text-[var(--label-secondary)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
          >
            Изменить номер
          </button>
        </div>
      </div>
    </div>
  );
}
