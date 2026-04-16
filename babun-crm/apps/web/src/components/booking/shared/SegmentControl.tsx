"use client";

interface SegmentControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}

// iOS-style segment control. Используется в BookingSheet для
// переключения между режимами "Клиент" и "Событие".
export default function SegmentControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentControlProps<T>) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[13px] font-semibold">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 rounded-lg transition ${
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 active:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
