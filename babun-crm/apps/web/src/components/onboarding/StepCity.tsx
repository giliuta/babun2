"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const CYPRUS_CITIES = [
  "Nicosia",
  "Limassol",
  "Larnaca",
  "Paphos",
  "Famagusta",
  "Ayia Napa",
  "Protaras",
  "Kyrenia",
];

export default function StepCity({ value, onChange, onBack, onNext }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      className="p-6 space-y-5"
    >
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          В каком городе вы работаете?
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Можно пропустить — пригодится для фильтров и аналитики позже.
        </p>
      </div>

      <input
        type="text"
        list="cyprus-cities"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Например, Limassol"
        maxLength={120}
        className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
      />
      <datalist id="cyprus-cities">
        {CYPRUS_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="h-11 px-4 text-[14px] font-medium text-[var(--label-secondary)] active:opacity-60"
        >
          ← Назад
        </button>
        <button
          type="submit"
          className="flex-1 h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] transition"
        >
          Далее
        </button>
      </div>
    </form>
  );
}
