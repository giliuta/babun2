"use client";

import type { Vertical } from "./OnboardingWizard";

interface Props {
  value: Vertical | null;
  onChange: (v: Vertical) => void;
  onBack: () => void;
  onNext: () => void;
}

interface Option {
  value: Vertical;
  emoji: string;
  label: string;
}

const OPTIONS: readonly Option[] = [
  { value: "hvac",     emoji: "🌬️",  label: "Кондиционеры" },
  { value: "beauty",   emoji: "💅",   label: "Красота и здоровье" },
  { value: "auto",     emoji: "🚗",   label: "Авто-сервис" },
  { value: "cleaning", emoji: "🧹",   label: "Клининг" },
  { value: "other",    emoji: "🛠️",   label: "Другое" },
];

export default function StepVertical({ value, onChange, onBack, onNext }: Props) {
  const ready = value !== null;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          Чем вы занимаетесь?
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Выберите ближайшее. Это помогает подобрать дефолты.
        </p>
      </div>

      <div className="bg-[var(--fill-quaternary)] rounded-[12px] divide-y divide-[var(--separator)] overflow-hidden">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition active:bg-[var(--fill-tertiary)] ${
                selected ? "bg-[var(--accent-tint)]" : ""
              }`}
            >
              <span className="text-[20px] shrink-0" aria-hidden>{opt.emoji}</span>
              <span className="flex-1 text-[15px] font-medium text-[var(--label)]">
                {opt.label}
              </span>
              {selected && (
                <span className="text-[var(--accent)] text-[18px]" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="h-11 px-4 text-[14px] font-medium text-[var(--label-secondary)] active:opacity-60"
        >
          ← Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!ready}
          className="flex-1 h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          Далее
        </button>
      </div>
    </div>
  );
}
