"use client";

import { useMemo } from "react";
import { useAppointments } from "@/components/layout/DashboardClientLayout";

// STORY-060 F3.6 — shared hook for the «Не закрыто» badge count.
// Both Sidebar и BottomTabBar read it so the two badges always agree
// without duplicating the filter logic.
//
// Counts:
//   • kind === "work" (or undefined for legacy rows)
//   • status === "scheduled" OR status === "in_progress"
//   • date < today (already past, never marked done)
//
// Matches the predicate used by `/dashboard/unclosed/page.tsx` so
// the badge and the inbox always show the same number.

export function useUnclosedCount(): number {
  const { appointments } = useAppointments();
  return useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let n = 0;
    for (const a of appointments) {
      if (a.kind && a.kind !== "work") continue;
      if (a.status !== "scheduled" && a.status !== "in_progress") continue;
      if (a.date >= todayKey) continue;
      n += 1;
    }
    return n;
  }, [appointments]);
}
