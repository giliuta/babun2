"use client";

// Shared layout wrapper for the five auth pages (login, register,
// forgot, reset, callback redirect). Telegram-style centered card with
// a Babun logo on top — matches the existing login stub from STORY-031.
//
// Visual decisions are locked in STORY-037 G3 — see the doc for the
// rationale (no gradient, iOS grouped-list inputs, pill CTA, etc.).

import type { ReactNode } from "react";

interface AuthCardProps {
  /** Title under the logo, 28px bold. */
  title: string;
  /** 15px secondary line under the title. */
  subtitle: string;
  /** The form (inputs + CTA + ghost links). */
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 64px)",
      }}
    >
      <div className="w-full max-w-sm flex-1 px-5 pb-24">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-[var(--accent)] rounded-[22px] flex items-center justify-center shadow-[0_20px_40px_-15px_rgba(62,136,247,0.5)]">
            <span className="text-[var(--label-on-accent)] text-[38px] font-bold">
              B
            </span>
          </div>
          <h1 className="text-[28px] font-bold text-[var(--label)] mt-5">
            {title}
          </h1>
          <p className="text-[15px] text-[var(--label-secondary)] mt-1">
            {subtitle}
          </p>
        </div>

        {children}
      </div>

      {/* STORY-053a follow-up — public auth pages must not name a
          specific tenant. STORY-071 added the legal links for GDPR/EU.
          Pinned to the bottom of the viewport so they don't drift into
          the form on tall screens but always read as a footer anchor. */}
      <footer
        className="w-full text-center text-[11px] text-[var(--label-tertiary)] py-3 px-5 bg-[var(--surface-grouped)]/80 backdrop-blur-md border-t border-[var(--separator)]/40 sticky bottom-0"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
        }}
      >
        <div className="space-x-2">
          <a href="/privacy" className="underline">Конфиденциальность</a>
          <span>·</span>
          <a href="/terms" className="underline">Условия</a>
          <span>·</span>
          <span>Babun &copy; 2026</span>
        </div>
      </footer>
    </main>
  );
}
