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
      className="min-h-screen flex items-start justify-center p-5 pt-16 bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 64px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-10">
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

        <p className="text-center text-[12px] text-[var(--label-tertiary)] mt-10">
          AirFix &copy; 2026 · Babun CRM
        </p>
      </div>
    </main>
  );
}
