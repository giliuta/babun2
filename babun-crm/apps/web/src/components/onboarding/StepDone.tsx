"use client";

import type { Vertical } from "./OnboardingWizard";

interface Props {
  name: string;
  vertical: Vertical | null;
  personalCalendar: boolean;
  onBack: () => void;
  onCommit: (next: "calendar" | "team") => void | Promise<void>;
  saving: boolean;
  error: string | null;
}

const VERTICAL_LABELS: Record<Vertical, string> = {
  hvac: "Кондиционеры",
  beauty: "Красота и здоровье",
  auto: "Авто-сервис",
  cleaning: "Клининг",
  other: "Другое",
};

export default function StepDone({
  name,
  vertical,
  personalCalendar,
  onBack,
  onCommit,
  saving,
  error,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          Всё готово!
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Babun настроен. Дальше — открыть календарь или сразу собирать команду.
        </p>
      </div>

      <div className="bg-[var(--fill-quaternary)] rounded-[12px] divide-y divide-[var(--separator)] overflow-hidden">
        <SummaryRow label="Бизнес" value={name || "—"} />
        <SummaryRow
          label="Тип"
          value={vertical ? VERTICAL_LABELS[vertical] : "—"}
        />
        <SummaryRow
          label="Календарь"
          value={personalCalendar ? "Личный" : "Для команды"}
        />
      </div>

      {error && (
        <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onCommit("calendar")}
          disabled={saving}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
        >
          {saving ? "Сохраняем…" : "Открыть календарь"}
        </button>
        {!personalCalendar && (
          <button
            type="button"
            onClick={() => onCommit("team")}
            disabled={saving}
            className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--accent)] text-[17px] font-semibold active:bg-[var(--fill-quaternary)] disabled:opacity-50 transition"
          >
            Настроить команду
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={saving}
        className="block mx-auto h-9 px-4 text-[13px] font-medium text-[var(--label-secondary)] active:opacity-60 disabled:opacity-50"
      >
        ← Назад
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="text-[13px] text-[var(--label-secondary)] w-20 shrink-0">
        {label}
      </span>
      <span
        className={`flex-1 text-[14px] ${
          muted ? "text-[var(--label-tertiary)] italic" : "text-[var(--label)] font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
