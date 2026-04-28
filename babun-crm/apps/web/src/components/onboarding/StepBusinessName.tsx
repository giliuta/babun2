"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export default function StepBusinessName({ value, onChange, onNext }: Props) {
  const ready = value.trim().length >= 2;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ready) onNext();
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          Как называется ваш бизнес?
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Можно поменять позже в настройках.
        </p>
      </div>

      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Например, AirFix или Beauty Studio Анны"
        maxLength={120}
        className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
      />

      <button
        type="submit"
        disabled={!ready}
        className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
      >
        Далее
      </button>
    </form>
  );
}
