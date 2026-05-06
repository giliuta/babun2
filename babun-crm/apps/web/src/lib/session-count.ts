// STORY-053b — session counter used by InstallPrompt + EnableNotifi-
// cationsPrompt to gate first-time popups (don't show until session
// 2). Lifted out of EnableNotificationsPrompt.tsx so DashboardClient-
// Layout can call `bumpSessionCount()` without statically importing
// the prompt component — the prompt itself is now lazy-loaded via
// next/dynamic and its bundle no longer ships on first paint.

const SESSION_KEY = "babun-session-count";

/** Increments the session counter on every dashboard mount. Mount
 *  this once near the root of the dashboard layout so the count goes
 *  up on each fresh page load (good enough heuristic for "session"). */
export function bumpSessionCount(): void {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    const current = (raw ? parseInt(raw, 10) : 0) || 0;
    window.localStorage.setItem(SESSION_KEY, String(current + 1));
  } catch {
    // ignore — quota / private mode
  }
}
