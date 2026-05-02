// STORY-053b — small platform-detection helpers used by the push +
// install-prompt flows. Server-side imports always return defaults
// (everything `false`); the real values populate at hydration.

export type Platform = "ios" | "android" | "desktop" | "other";

export interface PlatformInfo {
  platform: Platform;
  /** True when the page is running as a home-screen / installed PWA. */
  isStandalone: boolean;
  /** Major version number on iOS (e.g. 16, 17, 18) or null. */
  iosMajor: number | null;
  /** Web Push capability — needs SW + PushManager. On iOS it also
   *  requires standalone mode AND iOS >= 16.4. */
  canSubscribePush: boolean;
  /** True if Web Push install prompt should be considered (Android
   *  Chrome captures `beforeinstallprompt`; iOS uses manual instructions). */
  canShowInstallPrompt: boolean;
  /** Short label for `push_subscriptions.device_label` (e.g.
   *  "iPhone (Safari)", "Android (Chrome)"). */
  deviceLabel: string;
}

const SSR_DEFAULT: PlatformInfo = {
  platform: "other",
  isStandalone: false,
  iosMajor: null,
  canSubscribePush: false,
  canShowInstallPrompt: false,
  deviceLabel: "",
};

export function detectPlatform(): PlatformInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return SSR_DEFAULT;
  }

  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isAndroid = /Android/.test(ua);
  const platform: Platform = isIos
    ? "ios"
    : isAndroid
      ? "android"
      : /Mac|Windows|Linux/.test(ua)
        ? "desktop"
        : "other";

  const iosMajor = isIos ? parseIosMajor(ua) : null;

  // standalone detection works on both iOS (legacy `navigator.standalone`)
  // and modern browsers (`display-mode: standalone` media query).
  const standaloneMql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;
  const isStandalone =
    Boolean(standaloneMql?.matches) ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

  const hasPushApi =
    "serviceWorker" in navigator &&
    typeof window.PushManager !== "undefined";

  // iOS Safari only allows web push from a home-screen-installed PWA on
  // 16.4+. Plain Safari on iOS — no. Anything earlier — no.
  const iosPushReady =
    isIos && isStandalone && iosMajor !== null && iosMajor >= 17 // 17+ is safer than 16.4 in practice
      ? true
      : isIos
        ? false
        : null;

  const canSubscribePush =
    hasPushApi && (iosPushReady === null ? true : iosPushReady === true);

  const browserLabel = /CriOS/.test(ua)
    ? "Chrome"
    : /FxiOS/.test(ua)
      ? "Firefox"
      : /Edg/.test(ua)
        ? "Edge"
        : /Chrome/.test(ua)
          ? "Chrome"
          : /Firefox/.test(ua)
            ? "Firefox"
            : /Safari/.test(ua)
              ? "Safari"
              : "Browser";

  const deviceLabel =
    platform === "ios"
      ? `iPhone (${browserLabel})`
      : platform === "android"
        ? `Android (${browserLabel})`
        : platform === "desktop"
          ? `Desktop (${browserLabel})`
          : browserLabel;

  // Android with `beforeinstallprompt` event (gets captured in
  // EnableNotificationsPrompt mount); iOS gets manual instructions.
  const canShowInstallPrompt = !isStandalone && (isAndroid || isIos);

  return {
    platform,
    isStandalone,
    iosMajor,
    canSubscribePush,
    canShowInstallPrompt,
    deviceLabel,
  };
}

function parseIosMajor(ua: string): number | null {
  // "OS 17_4 like Mac OS X" → 17
  const m = /OS (\d+)[_\.]/.exec(ua);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
