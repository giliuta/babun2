"use client";

import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "@/lib/appointments";
import { getDebtAmount } from "@/lib/appointments";

interface EndOfDayBannerProps {
  appointments: Appointment[];
  teamId: string;
  onOpenUnpaid: () => void;
}

// After 18:00 local time, if any of today's completed visits still
// have an outstanding debt, nag the dispatcher with a sticky pill
// above the bottom tab bar. One-tap "Закрыть" routes to the unpaid
// list. Disappears automatically once every visit is closed or the
// dispatcher dismisses it for the rest of the evening.
const DISMISS_PREFIX = "babun:end-of-day-dismissed:";

export default function EndOfDayBanner({
  appointments,
  teamId,
  onOpenUnpaid,
}: EndOfDayBannerProps) {
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const dateKey = toDateKey(now);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${DISMISS_PREFIX}${dateKey}`;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, [dateKey]);

  const unpaidCount = useMemo(() => {
    let n = 0;
    for (const apt of appointments) {
      if (apt.date !== dateKey) continue;
      if (teamId && apt.team_id !== teamId) continue;
      if (apt.status !== "completed") continue;
      if (getDebtAmount(apt) > 0) n++;
    }
    return n;
  }, [appointments, dateKey, teamId]);

  const hour = now.getHours();
  if (hour < 18) return null;
  if (dismissed) return null;
  if (unpaidCount === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${DISMISS_PREFIX}${dateKey}`, "1");
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-30 px-3 lg:left-auto lg:right-4 lg:w-80"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 8px) + 76px)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 ring-1 ring-amber-300 shadow-md">
        <span className="text-[18px]" aria-hidden>
          ⚠
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-amber-900">
            {unpaidCount}{" "}
            {unpaidCount === 1 ? "запись без оплаты" : "записей без оплаты"}
          </div>
          <div className="text-[11px] text-amber-800">Закройте до конца дня</div>
        </div>
        <button
          type="button"
          onClick={onOpenUnpaid}
          className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 text-white text-[12px] font-semibold active:scale-[0.97]"
        >
          Открыть
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть"
          className="shrink-0 w-8 h-8 rounded-lg text-amber-700 active:bg-amber-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="mx-auto"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
