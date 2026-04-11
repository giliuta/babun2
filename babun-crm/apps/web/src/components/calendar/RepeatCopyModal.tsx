"use client";

import { useMemo, useState } from "react";
import DialogModal from "@/components/appointments/sheet/DialogModal";
import { duplicateAppointment, type Appointment } from "@/lib/appointments";
import { formatDateLongRu } from "@/lib/date-utils";

interface RepeatCopyModalProps {
  open: boolean;
  source: Appointment | null;
  onClose: () => void;
  onConfirm: (copies: Appointment[]) => void;
}

type RepeatMode = "daily" | "weekly" | "monthly";

const MODE_LABELS: Record<RepeatMode, string> = {
  daily: "Каждый день",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
};

// Generates N duplicate appointments at a given cadence, starting from
// the day after the source. Each copy uses duplicateAppointment() so it
// starts in the 'scheduled' state with no payments or photos.
export default function RepeatCopyModal({
  open,
  source,
  onClose,
  onConfirm,
}: RepeatCopyModalProps) {
  const [mode, setMode] = useState<RepeatMode>("weekly");
  const [count, setCount] = useState(4);

  const previewDates = useMemo<string[]>(() => {
    if (!source) return [];
    return buildDates(source.date, mode, count);
  }, [source, mode, count]);

  const handleConfirm = () => {
    if (!source) return;
    const copies: Appointment[] = previewDates.map((dateKey) => ({
      ...duplicateAppointment(source),
      date: dateKey,
    }));
    onConfirm(copies);
    onClose();
  };

  if (!source) return null;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Копировать многократно"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          disabled={previewDates.length === 0}
          className="w-full h-11 rounded-lg bg-indigo-600 text-white text-[14px] font-semibold active:scale-[0.98] disabled:bg-gray-300"
        >
          Создать {previewDates.length} копи{copyPlural(previewDates.length)}
        </button>
      }
    >
      <div className="p-4 space-y-4">
        <div className="text-[12px] text-gray-500">
          Исходная запись: {formatDateLongRu(source.date)} в {source.time_start}
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Периодичность
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(MODE_LABELS) as RepeatMode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 h-9 rounded-lg text-[12px] font-medium transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Количество копий
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 text-lg font-semibold active:scale-95"
            >
              −
            </button>
            <div className="flex-1 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-[16px] font-bold text-gray-900 tabular-nums">
              {count}
            </div>
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(52, c + 1))}
              className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 text-lg font-semibold active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Будут созданы
          </div>
          <div className="max-h-[160px] overflow-y-auto rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200">
            {previewDates.map((d) => (
              <div
                key={d}
                className="px-3 py-1.5 text-[12px] text-gray-700"
              >
                {formatDateLongRu(d)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DialogModal>
  );
}

function buildDates(startKey: string, mode: RepeatMode, count: number): string[] {
  const [y, m, d] = startKey.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const next = new Date(base);
    if (mode === "daily") next.setDate(base.getDate() + i);
    else if (mode === "weekly") next.setDate(base.getDate() + i * 7);
    else next.setMonth(base.getMonth() + i);
    const yy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

function copyPlural(n: number): string {
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return "й";
  if (last === 1) return "ю";
  if (last >= 2 && last <= 4) return "и";
  return "й";
}
