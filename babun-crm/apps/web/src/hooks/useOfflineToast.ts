"use client";

// STORY-060 — placeholder shipped to unblock the build after the
// import landed in DashboardClientLayout.tsx. Concrete offline-detect
// + toast wiring fills in as a follow-up commit.
//
// Returns nothing — the hook's side effect (showing a toast when the
// app goes offline) is a no-op until the real implementation lands.

export function useOfflineToast(): void {
  /* no-op placeholder */
}
