"use client";

// STORY-077 — Face ID / Touch ID / Passkey placeholder.
//
// Real implementation needs:
//   * WebAuthn enrollment flow (navigator.credentials.create)
//   * Server endpoint that stores the public key on auth.users.factors
//   * Login-side challenge that calls navigator.credentials.get and
//     bumps the session to aal2.
// Browser support is uneven (iOS PWA + Android Chrome OK, Edge/Firefox
// quirky). v402 ships the slot only.

import { ScanFace } from "@babun/shared/icons";

export default function FaceIdSection() {
  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Биометрия
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center shrink-0">
            <ScanFace size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-[var(--label)]">
              Face ID / Touch ID
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Вход по отпечатку или лицу через WebAuthn / passkey. Будет доступно после релиза iOS-приложения.
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-[var(--fill-tertiary)] text-[10px] uppercase tracking-wider font-bold text-[var(--label-tertiary)]">
            Скоро
          </span>
        </div>
      </div>
    </div>
  );
}
