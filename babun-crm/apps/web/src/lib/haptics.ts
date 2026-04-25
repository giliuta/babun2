// v316 — Multi-platform haptic feedback for Babun CRM PWA.
//
// Background: iOS Safari does NOT support `navigator.vibrate` (as of
// iOS 18). Android does. So a single haptic() call has historically
// been a no-op on the user's iPhone — exactly the platform we target.
//
// This rewrite layers three strategies:
//   1. Android — navigator.vibrate with a pattern table.
//   2. iOS 17.4+ — programmatically toggle a hidden
//      `<input type="checkbox" switch>` element. WebKit fires the
//      Taptic Engine when the switch flips, which is the only public
//      hook iOS gives us today. Works in standalone PWAs.
//   3. Audio-click fallback — opt-in via Settings. Near-silent
//      Web Audio click. Plays inside the user-gesture so it
//      satisfies iOS autoplay policy.
//
// Toggling is persisted in localStorage so the dispatcher can disable
// haptics entirely if they bother her in a quiet office.

type Pattern =
  | "tap"
  | "select"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 4,
  tap: 6,
  select: 8,
  medium: 12,
  heavy: 18,
  success: [10, 40, 14],
  warning: [14, 40, 14],
  error: [24, 60, 24],
};

const ENABLED_KEY = "babun:haptics:enabled";
const AUDIO_KEY = "babun:haptics:audio";

// ─── Settings ─────────────────────────────────────────────────────

export function getHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(ENABLED_KEY);
  return v === null ? true : v === "1";
}
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

export function getHapticsAudio(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUDIO_KEY) === "1";
}
export function setHapticsAudio(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIO_KEY, enabled ? "1" : "0");
}

// ─── Platform detection ───────────────────────────────────────────

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS ≥ 13 reports as Mac with touch, hence the maxTouchPoints check.
  return (
    /iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// ─── iOS Taptic via hidden <input type="checkbox" switch> ─────────
// Lives in the DOM forever (cheap), reused on every haptic() call.
// On iOS 17.4+ each toggle fires the Taptic Engine if System Haptics
// are enabled in the OS settings. On older iOS / non-Safari it just
// no-ops silently.

let _switchEl: HTMLInputElement | null = null;

function ensureSwitch(): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  if (_switchEl && _switchEl.isConnected) return _switchEl;
  const el = document.createElement("input");
  el.type = "checkbox";
  // The non-standard `switch` attribute is what triggers Taptic.
  el.setAttribute("switch", "");
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("tabindex", "-1");
  // Hide visually but keep it interactable from JS.
  el.style.position = "fixed";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.left = "-9999px";
  el.style.top = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  document.body.appendChild(el);
  _switchEl = el;
  return el;
}

function fireIOSSwitch(): void {
  const el = ensureSwitch();
  if (!el) return;
  try {
    el.checked = !el.checked;
    // Both events together cover Safari's Taptic trigger reliably.
    el.dispatchEvent(new Event("input", { bubbles: false }));
    el.dispatchEvent(new Event("change", { bubbles: false }));
  } catch {
    // ignore
  }
}

// ─── Audio-click fallback (opt-in) ────────────────────────────────

let _ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
  } catch {
    return null;
  }
  return _ctx;
}

interface ClickConfig {
  freq: number;
  vol: number;
  dur: number;
}
const CLICK_CONFIGS: Record<Pattern, ClickConfig> = {
  light: { freq: 180, vol: 0.03, dur: 0.018 },
  tap: { freq: 200, vol: 0.04, dur: 0.022 },
  select: { freq: 240, vol: 0.04, dur: 0.022 },
  medium: { freq: 160, vol: 0.06, dur: 0.030 },
  heavy: { freq: 80, vol: 0.10, dur: 0.040 },
  success: { freq: 360, vol: 0.05, dur: 0.060 },
  warning: { freq: 220, vol: 0.06, dur: 0.060 },
  error: { freq: 90, vol: 0.10, dur: 0.080 },
};

function playClick(pattern: Pattern): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  const cfg = CLICK_CONFIGS[pattern];
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(cfg.freq, now);
  // Click envelope — fast attack, exponential decay.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cfg.vol, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + cfg.dur + 0.02);
}

// ─── Public API ───────────────────────────────────────────────────

export function haptic(kind: Pattern = "tap"): void {
  if (typeof window === "undefined") return;
  if (!getHapticsEnabled()) return;

  // Vibration API (Android, some others).
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(PATTERNS[kind]);
    } catch {
      // ignore — gesture policy
    }
  }

  // iOS Taptic via switch toggle.
  if (isIOS()) {
    fireIOSSwitch();
  }

  // Audio fallback — only when user explicitly enabled it.
  if (getHapticsAudio()) {
    playClick(kind);
  }
}

// One-shot warm-up — call from a user gesture early in the app
// lifecycle to prime the AudioContext (otherwise iOS suspends it).
export function warmUpHaptics(): void {
  ensureSwitch();
  const c = ensureCtx();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}
