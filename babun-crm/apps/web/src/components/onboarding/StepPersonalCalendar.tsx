"use client";

// STORY-073 — Onboarding step 3: personal calendar opt-in.
//
// Replaces the older "City" step. The city is rarely useful at signup
// time — it's better captured per-day on the calendar. The personal
// calendar question is a real fork in the UX:
//   * "Да, мне лично" → calendar opens with a personal lane ready
//   * "Нет, для команды" → calendar opens to a 2-CTA empty state
//      that walks the owner into either turning personal on later
//      or setting up team / brigades.

import { CalendarHeart, Users } from "@babun/shared/icons";

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepPersonalCalendar({
  value,
  onChange,
  onBack,
  onNext,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          Кто будет вести календарь?
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Можно выбрать сейчас и поменять в Настройках в любой момент.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`w-full text-left px-4 py-3.5 rounded-[14px] border transition ${
            value
              ? "border-[var(--accent)] bg-[var(--accent-tint)]"
              : "border-[var(--separator)] bg-[var(--surface-card)] active:bg-[var(--fill-quaternary)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                value
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
              }`}
            >
              <CalendarHeart size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[var(--label)]">
                Личный календарь
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                Свои встречи, заметки, частная активность. Видишь только ты.
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`w-full text-left px-4 py-3.5 rounded-[14px] border transition ${
            !value
              ? "border-[var(--accent)] bg-[var(--accent-tint)]"
              : "border-[var(--separator)] bg-[var(--surface-card)] active:bg-[var(--fill-quaternary)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                !value
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
              }`}
            >
              <Users size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[var(--label)]">
                Календарь для команды
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                Бригады / мастера, общие визиты к клиентам. Команду пригласишь позже.
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-[50px] px-5 rounded-[var(--radius-pill)] bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-quaternary)] transition"
        >
          ← Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] transition"
        >
          Дальше
        </button>
      </div>
    </div>
  );
}
