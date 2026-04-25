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

// ─── Platform detection ───────────────────────────────────────────

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS ≥ 13 reports as Mac with touch, hence the maxTouchPoints check.
  return (
    /iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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
  const v = window.localStorage.getItem(AUDIO_KEY);
  // iOS Safari has no Vibration API and the <input switch> Taptic
  // trick is unreliable in real-world testing.  So on iPhone we
  // default the audio click ON — it's the only feedback that
  // actually fires.  Android already has navigator.vibrate, no
  // audio needed there.  The user can override in Settings.
  if (v === null) return isIOS();
  return v === "1";
}
export function setHapticsAudio(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIO_KEY, enabled ? "1" : "0");
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
// Tuned for a feel close to the iOS Phone-app context-menu tick.
// All clicks are <12 ms with very low volume — they read as a
// tactile "tk" rather than a tone.  Lower-pitched for heavier
// patterns (success/warning/error).
const CLICK_CONFIGS: Record<Pattern, ClickConfig> = {
  light:   { freq: 1800, vol: 0.06, dur: 0.006 },
  tap:     { freq: 1500, vol: 0.07, dur: 0.008 },
  select:  { freq: 2000, vol: 0.06, dur: 0.006 },
  medium:  { freq: 1200, vol: 0.10, dur: 0.010 },
  heavy:   { freq: 900,  vol: 0.13, dur: 0.014 },
  success: { freq: 1700, vol: 0.08, dur: 0.012 },
  warning: { freq: 1100, vol: 0.10, dur: 0.014 },
  error:   { freq: 700,  vol: 0.13, dur: 0.018 },
};

// Produces a percussive "tk" click by combining a short noise burst
// with a triangle-wave envelope.  Pure sine waves sound like a beep;
// triangle + noise reads as a tactile tick — much closer to the iOS
// system click the user hears in Contacts → context menu.
function playClick(pattern: Pattern): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  const cfg = CLICK_CONFIGS[pattern];
  const now = c.currentTime;

  // Triangle oscillator — gives the "click body".
  const osc = c.createOscillator();
  const oscGain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(cfg.freq, now);
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(cfg.vol, now + 0.0008);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur);

  // Tiny white-noise burst — gives the "tactile" attack.  Length is
  // half the click duration so the body of the click is the tone.
  const noiseLen = Math.max(64, Math.floor(c.sampleRate * cfg.dur * 0.5));
  const buffer = c.createBuffer(1, noiseLen, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.value = cfg.vol * 0.6;

  osc.connect(oscGain).connect(c.destination);
  noise.connect(noiseGain).connect(c.destination);
  osc.start(now);
  noise.start(now);
  osc.stop(now + cfg.dur + 0.01);
  noise.stop(now + cfg.dur);
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
