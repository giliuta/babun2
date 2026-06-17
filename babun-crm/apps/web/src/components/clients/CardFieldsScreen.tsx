"use client";

// v811 — «Что показывать на карточке». Nested full-screen sheet under
// «Настройки клиентов». Toggling a field updates the parent's live card
// prefs immediately, so the list cards add/remove the field at once. The
// client name is always shown and is rendered locked-on.

import { useEffect } from "react";
import { ChevronLeft, Info } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { registerModalBack } from "@/lib/history-stack";
import type { CardField, CardFieldPrefs } from "@/lib/client-card-prefs";

interface FieldRow {
  /** null = the always-on locked «Имя» row. */
  field: CardField | null;
  label: string;
  sub?: string;
  dot: string;
}

const ROWS: FieldRow[] = [
  { field: null, label: "Имя клиента", sub: "всегда видно", dot: "var(--label-tertiary)" },
  { field: "exp", label: "Ожидаемая прибыль", sub: "серая", dot: "var(--label-secondary)" },
  { field: "inc", label: "Доход", sub: "зелёный", dot: "var(--system-green)" },
  { field: "debt", label: "Долг", sub: "жёлтый", dot: "#B78600" },
  { field: "last", label: "Последняя запись", dot: "var(--label-tertiary)" },
  { field: "meta", label: "Календарь, метка, тег", dot: "var(--label-tertiary)" },
];

interface CardFieldsScreenProps {
  prefs: CardFieldPrefs;
  onToggle: (field: CardField) => void;
  onBack: () => void;
}

export function CardFieldsScreen({ prefs, onToggle, onBack }: CardFieldsScreenProps) {
  useEffect(() => {
    const popClose = registerModalBack("clients-card-fields", onBack);
    return popClose;
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[var(--surface-grouped)] animate-slide-in-right">
      {/* nav */}
      <div className="h-12 shrink-0 flex items-center justify-between px-1.5 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onBack();
          }}
          className="flex items-center h-10 px-1 text-[15px] font-medium text-[var(--accent)] active:opacity-60"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
          Настройки
        </button>
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--label)]">
          Что показывать
        </span>
        <span className="w-[96px]" />
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3.5 pt-1.5 pb-6">
        <div className="text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1.5 pt-4 pb-1.5">
          Поля карточки
        </div>
        <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)]">
          {ROWS.map((r) => {
            const locked = r.field === null;
            // Narrow on `r.field` itself — TS won't carry the `locked`
            // alias into the index expression.
            const on = r.field === null ? true : prefs[r.field];
            return (
              <div
                key={r.label}
                className="flex items-center gap-3 min-h-[50px] px-3.5 py-2 border-b border-[var(--separator)] last:border-b-0"
              >
                <span
                  className="w-[9px] h-[9px] rounded-full shrink-0"
                  style={{ background: r.dot }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-[var(--label)]">{r.label}</span>
                  {r.sub && (
                    <span className="block text-[12px] text-[var(--label-tertiary)] mt-px">
                      {r.sub}
                    </span>
                  )}
                </span>
                <Toggle
                  on={on}
                  locked={locked}
                  onChange={() => {
                    if (locked || !r.field) return;
                    haptic("tap");
                    onToggle(r.field);
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 px-3.5 py-3 rounded-[12px] bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] leading-snug">
          <span className="shrink-0 mt-px">
            <Info size={16} strokeWidth={2.2} />
          </span>
          Выключи поле — оно сразу пропадёт с карточек в списке. Имя всегда видно.
        </div>
      </div>
    </div>
  );
}

function Toggle({
  on,
  locked,
  onChange,
}: {
  on: boolean;
  locked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={locked}
      onClick={onChange}
      className={`relative w-11 h-[26px] rounded-full shrink-0 transition-colors ${
        on ? "bg-[var(--system-green)]" : "bg-[var(--fill-tertiary)]"
      } ${locked ? "opacity-45 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform ${
          on ? "translate-x-[18px]" : ""
        }`}
      />
    </button>
  );
}
