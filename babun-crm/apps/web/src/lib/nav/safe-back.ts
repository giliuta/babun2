// STORY-053b — `safeBack(router, fallback)`.
//
// Use INSIDE back-arrow `onClick` handlers (not for "go to list"
// CTAs, not for post-delete navigation — those genuinely need an
// explicit destination).
//
// Why a helper instead of `router.back()` directly:
//   * Cold deep-link case: a user opens `/dashboard/teams/[id]`
//     directly from a notification/share-link → `window.history`
//     has only the current entry. `router.back()` would either
//     no-op or pop the user out of the SPA entirely. Fall through
//     to `router.push(fallback)` so the back-arrow always lands
//     somewhere sensible.
//   * Plain-`router.push` was the bug: pushing the parent route
//     onto the stack INSTEAD of popping created an ever-growing
//     history that produced the "back-button loop" feedback the
//     user reported between Команда / Бригада / Мастер pages.
//
// SSR safety: `window` may be undefined during SSR — guard it.

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function safeBack(
  router: AppRouterInstance,
  fallback: string,
): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}
