"use client";

// First-run calendar setup screen.
//
// STORY audit: пользователь решил спрятать «Личный календарь» из
// onboarding-флоу. Функционал personal calendar готов и работает, но
// для нового тенанта это лишний выбор — большинство приходят чтобы
// записывать клиентов на команды. Личный календарь остаётся как
// опциональная фича, включить можно позже в Настройках.
//
// Новый flow: один большой CTA «Создать команду» → /dashboard/teams.
// Малая ссылка ниже даёт продвинутым доступ к personal-режиму.
//
// Когда у тенанта появилась хотя бы одна команда, page.tsx больше не
// показывает этот экран и пользователь попадает прямо в календарь.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "@babun/shared/icons";
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
              <Users size={28} strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-semibold text-[var(--label)] tracking-tight">
              Создадим команду
            </h1>
            <p className="mt-2 text-[14px] text-[var(--label-secondary)] leading-snug">
              Команда — это бригада мастеров, на которую записываются клиенты. Добавим первую и начнём работать.
            </p>
          </div>

          <button
            type="button"
            onClick={goToTeams}
            disabled={isPending}
            className="w-full h-12 rounded-[14px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center justify-center gap-2 active:bg-[var(--accent-pressed)] active:scale-[0.99] transition disabled:opacity-50 shadow-[0_4px_12px_rgba(0,0,0,0.10)]"
          >
            <Users size={18} strokeWidth={2.2} />
            Создать команду
          </button>

          {/* Малая ссылка для тех, кто пришёл вести личный календарь
              (фрилансер, единоличный мастер). Не выпячиваем, чтобы не
              мешать основному пути «команда → запись клиента». */}
          <button
            type="button"
            onClick={enablePersonal}
            disabled={isPending}
            className="w-full mt-4 text-[13px] text-[var(--label-tertiary)] active:opacity-70 transition disabled:opacity-50"
          >
            Я один — включить личный календарь
          </button>
        </div>
      </div>
    </div>
  );
}
