"use client";

// STORY-055 — iOS PWA install bottom sheet.
//
// Renders only when usePwaInstallState() says shouldShow. Visually a
// bottom sheet (slides up from below) with a drag handle, three
// numbered tutorial steps, and two action buttons:
//
//   · «Понятно, скрыть»  → permanent dismiss (never re-prompt)
//   · «Напомнить позже»  → 24h snooze
//
// Backdrop tap === snooze (least destructive default — same as the
// existing modal pattern in EnableNotificationsPrompt).
//
// Hardware-back integration: register with history-stack so Android
// hardware-back / iOS swipe-edge gesture closes the sheet via the
// same snooze path instead of falling through to URL navigation.

import { useEffect, useRef } from "react";
import { detectPlatform } from "@/lib/platform";
import { registerModalBack } from "@/lib/history-stack";
import { BabunMark } from "@/components/ui/BabunMark";
import { usePwaInstallState } from "./usePwaInstallState";

export function IOSInstallPrompt() {
  const { shouldShow, dismissPermanent, snooze24h } = usePwaInstallState();
  const popCloseRef = useRef<(() => void) | null>(null);

  // Hardware-back / edge-swipe → snooze. We capture stable refs to
  // the dismiss handlers via closure here; the registered handler
  // re-runs only when shouldShow transitions, which is exactly
  // when we want to re-bind anyway.
  useEffect(() => {
    if (!shouldShow) {
      popCloseRef.current?.();
      popCloseRef.current = null;
      return;
    }
    if (popCloseRef.current) return;
    popCloseRef.current = registerModalBack("ios-install-prompt", () => {
      snooze24h();
    });
  }, [shouldShow, snooze24h]);

  if (!shouldShow) return null;

  const { isIPad } = detectPlatform();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--surface-overlay)] animate-backdrop-in"
      onClick={snooze24h}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-t-[var(--radius-sheet)] shadow-[var(--shadow-sheet)] pt-2 pb-[max(env(safe-area-inset-bottom),16px)] px-5 animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="mx-auto h-1 w-9 rounded-full bg-[var(--fill-tertiary)] mb-4"
        />

        <div className="flex items-center gap-3">
          {/* STORY-062 — shared placeholder mark. Swap one component
              file when the designed brand mark lands. */}
          <BabunMark size={48} radius={12} />
          <div className="flex-1 min-w-0">
            <h2
              id="ios-install-title"
              className="text-[18px] font-semibold text-[var(--label)] tracking-tight"
            >
              Установить Babun
            </h2>
            <p className="text-[13px] text-[#3C3C43A6] mt-0.5">
              Откроется как обычное приложение, без браузера
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          <Step
            n={1}
            text={
              <>
                Тапни <ShareIcon />{" "}
                <span className="text-[var(--label-secondary)]">
                  «Поделиться»
                </span>{" "}
                {isIPad ? "в правом верхнем углу" : "внизу Safari"}
              </>
            }
          />
          <Step n={2} text="Найди «На главный экран» в списке" />
          <Step n={3} text="Нажми «Добавить» — и готово" />
        </ol>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={dismissPermanent}
            className="h-11 rounded-[12px] bg-[#1F66D7] hover:bg-[#1850A8] text-white text-[15px] font-semibold transition active:scale-[0.99]"
          >
            Понятно, скрыть
          </button>
          <button
            type="button"
            onClick={snooze24h}
            className="h-11 rounded-[12px] text-[var(--label)] text-[15px] font-medium hover:bg-[var(--fill-quaternary)] transition"
          >
            Напомнить позже
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px] leading-snug text-[#3C3C43D9]">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(31,102,215,0.12)] text-[#1F66D7] text-[12px] font-semibold flex items-center justify-center"
        aria-hidden
      >
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <span
      className="inline-flex items-center justify-center align-middle"
      style={{ width: 18, height: 18 }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="16"
        height="16"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </span>
  );
}
