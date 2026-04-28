"use client";

// Onboarding visual shell — Babun B logo, progress bar, centered card.
// Each active step is keyed so the slide-in animation re-triggers.

import type { ReactNode } from "react";

interface Props {
  step: 1 | 2 | 3 | 4;
  totalSteps: number;
  children: ReactNode;
}

export default function OnboardingShell({ step, totalSteps, children }: Props) {
  return (
    <main
      className="min-h-screen flex items-start justify-center p-5 pt-16 bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 64px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-[var(--accent)] rounded-[20px] flex items-center justify-center shadow-[0_16px_30px_-15px_rgba(62,136,247,0.5)]">
            <span className="text-[var(--label-on-accent)] text-[28px] font-bold">
              B
            </span>
          </div>
        </div>

        {/* Progress bar — 4 segments, current + previous highlighted. */}
        <div
          className="flex items-center gap-1.5 mb-6 px-2"
          aria-label={`Шаг ${step} из ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }, (_, i) => {
            const filled = i + 1 <= step;
            return (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  filled ? "bg-[var(--accent)]" : "bg-[var(--fill-tertiary)]"
                }`}
              />
            );
          })}
        </div>

        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="onboarding-step-enter" key={step}>
            {children}
          </div>
        </div>

        <p className="text-center text-[12px] text-[var(--label-tertiary)] mt-8">
          Babun CRM
        </p>
      </div>
    </main>
  );
}
