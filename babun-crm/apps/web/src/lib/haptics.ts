// Thin wrapper over the Vibration API so callers don't have to check
// for existence every time. Modern iOS Safari (16+) and Android honour
// short pulses when the user installs the PWA. Desktop and unsupported
// browsers silently no-op.

type Pattern = "tap" | "success" | "warning" | "error" | "select";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 6,
  select: 10,
  success: [10, 40, 14],
  warning: [14, 40, 14],
  error: [24, 60, 24],
};

export function haptic(kind: Pattern = "tap"): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // ignore — user gesture policy etc.
  }
}
