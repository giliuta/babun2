"use client";

// STORY-053b — install prompt rewrite (G4e).
// STORY-055 — iOS branch lifted out into IOSInstallPrompt with a
// different cadence (30s/2nd-nav + dual dismiss). This component now
// covers ANDROID ONLY. iOS users see the bottom sheet from
// components/install/IOSInstallPrompt.tsx instead.
//
// Trigger gates (all must hold):
//   - not already standalone
//   - platform === "android"
//   - sessionCount >= 2 (same babun-session-count counter
//     EnableNotificationsPrompt reads)
//   - dismissed-at flag missing OR > 7 days old
//
// Decline path: dismiss flag set for 7 days. Accept on Android: try
// the prompt; on accept set the flag permanently.

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

type Visibility = "hidden" | "android" | "unknown";

export function InstallPrompt() {
  const [vis, setVis] = useState<Visibility>("hidden");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const popCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const { isStandalone, platform } = detectPlatform();
    if (isStandalone) return;
    // iOS handled by components/install/IOSInstallPrompt — bail here.
    if (platform === "ios") return;

    const sessions = readSessionCount();
    if (sessions < 2) return;

    const dismissedAt = readDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < SEVEN_DAYS_MS) return;

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
