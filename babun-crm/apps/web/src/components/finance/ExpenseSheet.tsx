"use client";

import { useEffect, useState } from "react";
import type { ExpenseCategoryKey } from "@/lib/day-extras";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ORDER,
} from "@/lib/finance/expense-categories";
import { formatEUR } from "@/lib/money";

interface ExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  /** Человекочитаемый заголовок дня (например "Сегодня, 16 апр"). */
  dayLabel?: string;
  /** Бригада для отображения в заголовке. */
  teamLabel?: string;
  onSave: (payload: {
    category: ExpenseCategoryKey;
    amount: number;
    comment: string;
    name: string; // имя для DayExtra.name (label категории + comment)
  }) => void;
}

// STORY-003 ExpenseSheet — быстрое добавление расхода бригады.
// Bottom sheet, категории 2×2, ряд быстрых сумм, textarea comment,
// sticky-кнопка с итогом. Интегрируется с DayExtra через onSave.
export default function ExpenseSheet({
  open,
  onClose,
  dayLabel,
  teamLabel,
  onSave,
}: ExpenseSheetProps) {
  const [category, setCategory] = useState<ExpenseCategoryKey | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory(null);
    setAmountStr("");
    setComment("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const amount = Number(amountStr) || 0;
  const canSave = category !== null && amount > 0;

  const handleSave = () => {
    if (!category || amount <= 0) return;
    const cfg = EXPENSE_CATEGORIES[category];
    const name = comment.trim()
      ? `${cfg.label}: ${comment.trim()}`
      : cfg.label;
    onSave({ category, amount, comment: comment.trim(), name });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-1 pb-3 flex-shrink-0">
          {(dayLabel || teamLabel) && (
            <p className="text-[12px] text-slate-500">
              {[dayLabel, teamLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          <h2 className="text-[19px] font-semibold text-slate-900 mt-0.5">
            Расход бригады
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Category grid 2×2 */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Категория
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPENSE_CATEGORY_ORDER.map((key) => {
                const cfg = EXPENSE_CATEGORIES[key];
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition active:scale-[0.98] ${
                      active ? "shadow-sm" : "border-slate-200 bg-white"
                    }`}
                    style={
                      active
                        ? {
                            borderColor: cfg.color,
                            background: `${cfg.color}12`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[18px]"
                      style={{
                        background: `${cfg.color}22`,
                      }}
                    >
                      {cfg.emoji}
                    </div>
                    <div
                      className={`text-[14px] font-semibold text-left ${
                        active ? "" : "text-slate-800"
                      }`}
                      style={active ? { color: cfg.color } : undefined}
                    >
                      {cfg.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Сумма
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-14">
              <span className="text-[22px] font-bold text-slate-400 tabular-nums">€</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-[28px] font-bold text-slate-900 tabular-nums focus:outline-none placeholder-slate-300"
              />
            </div>

            {/* Quick-amounts — видны только когда выбрана категория */}
            {category && EXPENSE_CATEGORIES[category].quickAmounts.length > 0 && (
              <div className="flex gap-2 mt-2">
                {EXPENSE_CATEGORIES[category].quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmountStr(String(q))}
                    className="flex-1 h-10 rounded-lg bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 active:bg-slate-50 tabular-nums"
                  >
                    €{q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comment */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Комментарий
            </div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Что-то добавить"
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Sticky save */}
        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-slate-200"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-12 rounded-xl bg-rose-500 text-white text-[15px] font-semibold active:scale-[0.99] transition disabled:bg-slate-300 disabled:text-slate-500"
          >
            {canSave
              ? `Добавить расход · −${formatEUR(amount)}`
              : "Выберите категорию и сумму"}
          </button>
        </div>
      </div>
    </div>
  );
}
