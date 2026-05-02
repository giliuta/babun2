"use client";

// STORY-053b — install prompt rewrite (G4e).
//
// Replaces the previous toast-style banner with a proper centered
// modal. Three numbered steps for iOS (Safari → Share → Add to Home
// Screen). On Android, single button via `beforeinstallprompt`.
//
// Trigger gates (all must hold):
//   - not already standalone
//   - sessionCount >= 2 (uses the same babun-session-count counter
//     that EnableNotificationsPrompt reads)
//   - dismissed-at flag missing OR > 7 days old
//
// Decline path: dismiss flag set for 7 days. Accept on Android: try
// the prompt; on accept set the flag permanently. iOS doesn't have
// programmatic accept — user follows the steps and our flag is set
// by the "Понятно" button.

import { useEffect, useRef, useState } from "react";
import { detectPlatform } from "@/lib/platform";
import { getStorage } from "@babun/shared/storage";
import { registerModalBack } from "@/lib/history-stack";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "babun-pwa-install-dismissed";
const SESSION_KEY = "babun-session-count";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Visibility = "hidden" | "ios" | "android" | "unknown";

export function InstallPrompt() {
  const [vis, setVis] = useState<Visibility>("hidden");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const popCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const { isStandalone, platform } = detectPlatform();
    if (isStandalone) return;

    const sessions = readSessionCount();
    if (sessions < 2) return;

    const dismissedAt = readDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < SEVEN_DAYS_MS) return;

    if (platform === "ios") {
      setVis("ios");
      return;
    }

    // Android — wait briefly for `beforeinstallprompt` to land. If it
    // doesn't, fall back to the platform's panel with generic copy.
    let captured = false;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      captured = true;
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVis("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const fallback = window.setTimeout(() => {
      if (!captured) setVis(platform === "android" ? "android" : "unknown");
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(fallback);
    };
  }, []);

  // Register hardware-back handler whenever the prompt is visible.
  useEffect(() => {
    if (vis === "hidden") {
      popCloseRef.current?.();
      popCloseRef.current = null;
      return;
    }
    if (popCloseRef.current) return;
    popCloseRef.current = registerModalBack("install-prompt", () => {
      writeDismissedAt(Date.now());
      setInstallEvent(null);
      setVis("hidden");
    });
  }, [vis]);

  if (vis === "hidden") return null;

  const onAndroidInstall = async () => {
    if (!installEvent) {
      writeDismissedAt(Date.now());
      setVis("hidden");
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    writeDismissedAt(Date.now());
    setInstallEvent(null);
    setVis("hidden");
    void choice;
  };

  const dismiss = () => {
    writeDismissedAt(Date.now());
    setInstallEvent(null);
    setVis("hidden");
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] p-4 animate-backdrop-in"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm bg-[var(--surface-card)] rounded-[var(--radius-sheet)] shadow-[var(--shadow-sheet)] p-5 animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[12px] bg-[#1F66D7] text-white flex items-center justify-center text-[22px] font-bold tracking-tight">
            B
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-semibold text-[var(--label)] tracking-tight">
              Установить Babun
            </h2>
            <p className="text-[13px] text-[#3C3C43A6] mt-0.5">
              На главный экран как обычное приложение
            </p>
          </div>
        </div>

        {vis === "ios" && (
          <ol className="mt-5 space-y-3">
            <Step
              n={1}
              text={
                <>
                  Тапни кнопку <ShareIcon />{" "}
                  <span className="text-[var(--label-secondary)]">
                    «Поделиться»
                  </span>{" "}
                  внизу Safari
                </>
              }
            />
            <Step n={2} text="Найди «На главный экран» в списке" />
            <Step n={3} text="Нажми «Добавить»" />
          </ol>
        )}

        {vis === "android" && (
          <p className="mt-5 text-[14px] leading-snug text-[#3C3C43D9]">
            Тапни «Установить» — Babun добавится на главный экран и
            откроется в полноэкранном режиме.
          </p>
        )}

        {vis === "unknown" && (
          <p className="mt-5 text-[14px] leading-snug text-[#3C3C43D9]">
            Открой Babun в Safari (на iPhone) или Chrome (на Android),
            чтобы установить как приложение.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {vis === "android" && (
            <button
              type="button"
              onClick={onAndroidInstall}
              className="h-11 rounded-[12px] bg-[#1F66D7] hover:bg-[#1850A8] text-white text-[15px] font-semibold transition active:scale-[0.99]"
            >
              Установить
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="h-11 rounded-[12px] text-[var(--label)] text-[15px] font-medium hover:bg-[var(--fill-quaternary)] transition"
          >
            {vis === "android" ? "Не сейчас" : "Понятно"}
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

function readSessionCount(): number {
  try {
    const raw = getStorage().getRaw(SESSION_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function readDismissedAt(): number | null {
  try {
    const raw = getStorage().getRaw(DISMISS_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number): void {
  try {
    getStorage().setRaw(DISMISS_KEY, String(ts));
  } catch {
    // ignore — quota / private mode
  }
}
