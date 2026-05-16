"use client";

// First-run calendar setup screen.
//
// When a freshly signed-up tenant lands on /dashboard for the first
// time, they have:
//   - no teams configured
//   - personal_calendar_enabled = false (column default)
//   - no appointments
// In that state the calendar grid is meaningless. Instead we cover
// the whole content area with a two-CTA card asking the user how
// they'll use the calendar:
//
//   1. "Создать личный календарь для событий"
//      → flips personal_calendar_enabled = true and routes to
//        Settings → Мой календарь so the user can pick name + colour
//        + working hours.
//   2. "Создать календарь для записи клиентов"
//      → routes to /dashboard/teams to create the first brigade.
//        Once a brigade exists, the calendar grid becomes useful.
//
// Either path resolves the gating condition, so on the next visit
// the user lands directly on the (now meaningful) grid.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, Users } from "@babun/shared/icons";
import { setPersonalCalendarEnabled } from "@/app/dashboard/settings/account/personal-calendar-action";

interface Props {
  /** Called after a successful enable so the caller can refresh local
   *  state (re-read tenants.personal_calendar_enabled) before
   *  navigating away. Optional. */
  onEnabledRefresh?: () => void | Promise<void>;
}

export function FirstRunCalendarChoice({ onEnabledRefresh }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const enablePersonal = () => {
    startTransition(async () => {
      const res = await setPersonalCalendarEnabled(true);
      if (res.ok) {
        await onEnabledRefresh?.();
        router.push("/dashboard/settings/calendar");
      }
    });
  };

  const goToTeams = () => {
    router.push("/dashboard/teams");
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
              <CalendarHeart size={28} strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-semibold text-[var(--label)] tracking-tight">
              Как будешь пользоваться календарём?
            </h1>
            <p className="mt-2 text-[14px] text-[var(--label-secondary)] leading-snug">
              Можно выбрать любой вариант сейчас и поменять позже в настройках.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={enablePersonal}
              disabled={isPending}
              className="w-full bg-[var(--surface-card)] rounded-[16px] shadow-[var(--shadow-card)] p-4 flex items-start gap-3 text-left active:bg-[var(--fill-quaternary)] transition disabled:opacity-50"
            >
              <span className="w-11 h-11 rounded-[12px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <CalendarHeart size={20} strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-semibold text-[var(--label)]">
                  Личный календарь для событий
                </span>
                <span className="block text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Свои встречи и заметки. Видны только тебе, не команде.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={goToTeams}
              disabled={isPending}
              className="w-full bg-[var(--surface-card)] rounded-[16px] shadow-[var(--shadow-card)] p-4 flex items-start gap-3 text-left active:bg-[var(--fill-quaternary)] transition disabled:opacity-50"
            >
              <span className="w-11 h-11 rounded-[12px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Users size={20} strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-semibold text-[var(--label)]">
                  Календарь для записи клиентов
                </span>
                <span className="block text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Запишем клиентов на команду или мастера, увидим расписание команды.
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
