"use client";

interface TimeEditorProps {
  timeStart: string;
  timeEnd: string;
  onChange: (timeStart: string, timeEnd: string) => void;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, mins));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// STORY-002-FINAL: inline time editor с −15 / +15 кнопками.
// Конец автоматически подтягивается если новый start позже текущего
// end. Минимум 15 мин между start и end.
export default function TimeEditor({ timeStart, timeEnd, onChange }: TimeEditorProps) {
  const startMin = toMinutes(timeStart);
  const endMin = toMinutes(timeEnd);

  const shiftStart = (delta: number) => {
    const next = startMin + delta;
    const nextEnd = Math.max(next + 15, endMin);
    onChange(fromMinutes(next), fromMinutes(nextEnd));
  };

  const shiftEnd = (delta: number) => {
    const next = Math.max(startMin + 15, endMin + delta);
    onChange(timeStart, fromMinutes(next));
  };

  return (
    <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2">
      <Row
        label="Начало"
        value={timeStart}
        onMinus={() => shiftStart(-15)}
        onPlus={() => shiftStart(15)}
      />
      <Row
        label="Конец"
        value={timeEnd}
        onMinus={() => shiftEnd(-15)}
        onPlus={() => shiftEnd(15)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-slate-500 w-14">{label}</span>
      <button
        type="button"
        onClick={onMinus}
        className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 text-[14px] font-bold active:bg-slate-200"
      >
        −15
      </button>
      <div className="flex-1 text-center text-[18px] font-bold text-slate-900 tabular-nums">
        {value}
      </div>
      <button
        type="button"
        onClick={onPlus}
        className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 text-[14px] font-bold active:bg-slate-200"
      >
        +15
      </button>
    </div>
  );
}
