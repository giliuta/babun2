"use client";

// STORY-055 — iOS PWA install prompt timing + dismissal hook.
//
// Why a separate hook from the existing pwa/InstallPrompt: the older
// component fires only after `babun-session-count >= 2` (i.e. user's
// second visit). For iOS specifically we want a more deliberate first-
// visit nudge that respects user attention:
//
//   trigger = 30s of dwell time  OR  user has navigated once
//             (whichever fires first)
//
// Two dismiss tiers — different from the existing single 7-day flag:
//   · "Понятно скрыть"   → permanent flag, never re-prompt on this device
//   · "Напомнить позже"  → 24h snooze flag
//
// Permanent flag wins. Snooze flag is checked against now-24h. If both
// are missing the prompt is eligible.
//
// Detection: iOS Safari only (not Chrome-on-iOS — that one can't install
// PWAs anyway), not already standalone. Anything else (Android, desktop)
// is handled by the existing pwa/InstallPrompt component.

/* eslint-disable react-hooks/set-state-in-effect */
// The two setState-in-effect calls below are flagged by the lint
// rule but match the established hydration-from-external-system
// pattern used in OfflineIndicator and QuotaBanner: we read browser-
// only state (UA, storage, router) inside an effect and surface it
// to React. There is no external "subscription" form that fits.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { detectPlatform } from "@/lib/platform";
import { getStorage } from "@babun/shared/storage";

const PERMANENT_KEY = "babun:install-prompt-dismissed-permanent";
const SNOOZE_KEY = "babun:install-prompt-snoozed-at";
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const DWELL_MS = 30_000;

export interface PwaInstallState {
  /** True once eligibility passes AND the trigger (timer or nav) fires. */
  shouldShow: boolean;
  /** Permanent dismiss — set the flag and hide. */
  dismissPermanent: () => void;
  /** 24h snooze — set the timestamp and hide. */
  snooze24h: () => void;
}

export function usePwaInstallState(): PwaInstallState {
  const [eligible, setEligible] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  const initialPathRef = useRef<string | null>(null);

  // Eligibility — runs once after hydration. We don't watch storage
  // for changes because the dismiss flags are only written by this
  // hook (own component callbacks); a stale eligibility flip can't
  // race the dismiss handlers in the same browser tab.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // STORY-055 — one-time migration from the old single-namespace
    // dismiss key (`babun-pwa-install-dismissed`, owned by the
    // pre-iOS-split InstallPrompt) into the new permanent flag.
    // Anyone who already dismissed the old prompt should not see the
    // new bottom sheet either. Snooze timestamps don't migrate —
    // they were 7-day-windowed and roll off naturally.
    migrateLegacyDismiss();

    const { platform, isStandalone } = detectPlatform();
    if (platform !== "ios" || isStandalone) return;

    // Safari-only — Chrome-on-iOS uses the same WebKit engine but
    // the "Add to Home Screen" share-sheet flow only renders the
    // PWA-aware option in real Safari. Showing this prompt in
    // CriOS/FxiOS would just confuse the user.
    const ua = navigator.userAgent || "";
    const isSafariOnIOS =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!isSafariOnIOS) return;

    if (readPermanent()) return;
    const snoozedAt = readSnooze();
    if (snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) return;

    setEligible(true);
  }, []);

  // 30s dwell timer — armed only when eligible. Cleared if the
  // component unmounts or the user dismisses early (hidden flips).
  useEffect(() => {
    if (!eligible || triggered || hidden) return;
    const t = window.setTimeout(() => setTriggered(true), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [eligible, triggered, hidden]);

  // 2nd-page-nav trigger — capture the path the hook first saw, then
  // fire on any subsequent change. usePathname returns the current
  // App Router pathname; it updates on client-side navigation.
  useEffect(() => {
    if (!eligible || triggered || hidden) return;
    if (initialPathRef.current === null) {
      initialPathRef.current = pathname ?? "";
      return;
    }
    if (pathname && pathname !== initialPathRef.current) {
      setTriggered(true);
    }
  }, [pathname, eligible, triggered, hidden]);

  const dismissPermanent = () => {
    try {
      getStorage().setRaw(PERMANENT_KEY, "1");
    } catch {
      // storage quota / private mode — accept the loss; if the user
      // resurfaces the prompt they can dismiss again.
    }
    setHidden(true);
  };

  const snooze24h = () => {
    try {
      getStorage().setRaw(SNOOZE_KEY, String(Date.now()));
    } catch {
      // same — silent.
    }
    setHidden(true);
  };

  return {
    shouldShow: eligible && triggered && !hidden,
    dismissPermanent,
    snooze24h,
  };
}

function migrateLegacyDismiss(): void {
  try {
    const storage = getStorage();
    const legacy = storage.getRaw("babun-pwa-install-dismissed");
    if (!legacy) return;
    if (storage.getRaw(PERMANENT_KEY)) {
      // New flag already set — drop the legacy one and move on.
      storage.remove("babun-pwa-install-dismissed");
      return;
    }
    storage.setRaw(PERMANENT_KEY, "1");
    storage.remove("babun-pwa-install-dismissed");
  } catch {
    // storage unavailable — same as the rest of this hook, accept
    // the loss; user can dismiss again next session.
  }
}

function readPermanent(): boolean {
  try {
    return getStorage().getRaw(PERMANENT_KEY) === "1";
  } catch {
    return false;
  }
}

function readSnooze(): number | null {
  try {
    const raw = getStorage().getRaw(SNOOZE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
