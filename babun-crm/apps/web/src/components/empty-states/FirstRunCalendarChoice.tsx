"use client";

// First-run calendar setup screen.
//
// Shown by /dashboard when the tenant has no calendar yet (no active
// team) — see the gate in dashboard/page.tsx. One big CTA «Создать
// календарь» routes to /dashboard/teams?new=1, which immediately spins
// up a fresh team and drops the owner straight into its calendar
// settings (name + hours + labels). Once at least one team exists,
// page.tsx stops rendering this screen and the user lands in the
// calendar.
//
// v792 — the personal-calendar branch was removed from this screen.
// «Мой календарь» is parked behind PERSONAL_CALENDAR_ENABLED until it's
// fully designed, so the first run offers exactly one path: create a
// team calendar.

import { useRouter } from "next/navigation";
import { CalendarPlus } from "@babun/shared/icons";

export function FirstRunCalendarChoice() {
  const router = useRouter();

  const createCalendar = () => {
    router.push("/dashboard/teams?new=1");
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-[18px] flex items-center justify-center text-white"
              style={{ background: "var(--brand-mark-grad)" }}
            >
              <CalendarPlus size={28} strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-semibold text-[var(--label)] tracking-tight">
              Здесь будет ваш календарь
            </h1>
            <p className="mt-2 text-[14px] text-[var(--label-secondary)] leading-snug">
              Календарь — это расписание, куда вы записываете клиентов по дням и часам. Создайте первый — и можно начинать.
            </p>
          </div>

          <button
            type="button"
            onClick={createCalendar}
            className="w-full h-12 rounded-[14px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center justify-center gap-2 active:bg-[var(--accent-pressed)] active:scale-[0.99] transition shadow-[0_4px_12px_rgba(0,0,0,0.10)]"
          >
            <CalendarPlus size={18} strokeWidth={2.2} />
            Создать календарь
          </button>
        </div>
      </div>
    </div>
  );
}
