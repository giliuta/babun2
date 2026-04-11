"use client";

import { useEffect, useState } from "react";
import DialogModal from "@/components/appointments/sheet/DialogModal";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { getServiceMaterialCost } from "@/lib/services";
import type { DayExtra } from "@/lib/day-extras";
import { sumExtras } from "@/lib/day-extras";
import { generateId } from "@/lib/masters";

interface DayFinanceModalProps {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  dateLabel: string; // human-readable, e.g. "Вт, 7 апреля"
  appointments: Appointment[];
  services: Service[];
  extras: DayExtra[];
  onSave: (extras: DayExtra[]) => void;
}

export default function DayFinanceModal({
  open,
  onClose,
  dateKey,
  dateLabel,
  appointments,
  services,
  extras,
  onSave,
}: DayFinanceModalProps) {
  const [localExtras, setLocalExtras] = useState<DayExtra[]>(extras);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [newKind, setNewKind] = useState<"income" | "expense">("expense");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalExtras(extras);
      setNewName("");
      setNewAmount("");
      setNewKind("expense");
      setShowAdd(false);
    }
  }, [open, extras]);

  // Compute day totals from appointments
  const apptIncome = appointments
    .filter((a) => a.status === "completed" || a.status === "in_progress")
    .reduce((sum, a) => sum + getPaidAmount(a), 0);

  const apptMaterialCost = appointments
    .filter((a) => a.status === "completed" || a.status === "in_progress")
    .reduce((sum, a) => {
      const cost = a.service_ids.reduce((c, sid) => {
        const s = services.find((x) => x.id === sid);
        return c + (s ? getServiceMaterialCost(s) : 0);
      }, 0);
      return sum + cost;
    }, 0);

  const apptManualExpenses = appointments.reduce(
    (sum, a) => sum + a.expenses.reduce((s, e) => s + e.amount, 0),
    0
  );

  const extrasSum = sumExtras(localExtras);
  const totalIncome = apptIncome + extrasSum.income;
  const totalExpense = apptMaterialCost + apptManualExpenses + extrasSum.expense;
  const profit = totalIncome - totalExpense;

  const handleAddExtra = () => {
    const name = newName.trim();
    const amount = typeof newAmount === "number" ? newAmount : 0;
    if (!name || amount <= 0) return;
    setLocalExtras((prev) => [
      ...prev,
      { id: generateId("dx"), name, amount, kind: newKind },
    ]);
    setNewName("");
    setNewAmount("");
    setShowAdd(false);
  };

  const handleRemoveExtra = (id: string) => {
    setLocalExtras((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConfirm = () => {
    onSave(localExtras);
    onClose();
  };

  void dateKey;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={`Финансы · ${dateLabel}`}
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-12 bg-indigo-600 text-white rounded-xl font-semibold text-[14px] active:scale-[0.98] transition"
        >
          Сохранить
        </button>
      }
    >
      <div className="pb-2">
        {/* Appointments-sourced rows (read-only) */}
        {appointments.length > 0 ? (
          <>
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Из записей
            </div>
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-100">
              <span className="text-[13px] text-emerald-700">Доход</span>
              <span className="text-[13px] font-semibold text-emerald-700 tabular-nums">
                +{apptIncome}
              </span>
            </div>
            {apptMaterialCost > 0 && (
              <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-100">
                <span className="text-[13px] text-red-600">Материалы</span>
                <span className="text-[13px] font-semibold text-red-600 tabular-nums">
                  −{apptMaterialCost}
                </span>
              </div>
            )}
            {apptManualExpenses > 0 && (
              <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-100">
                <span className="text-[13px] text-red-600">Расходы по записям</span>
                <span className="text-[13px] font-semibold text-red-600 tabular-nums">
                  −{apptManualExpenses}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 pt-3 pb-2 text-[12px] text-gray-400">
            Записей на этот день нет
          </div>
        )}

        {/* Day-level extras */}
        <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Дополнительно
        </div>
        {localExtras.length > 0 ? (
          localExtras.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 px-4 py-1.5 border-t border-gray-100"
            >
              <div
                className={`w-1 h-5 rounded-full flex-shrink-0 ${
                  e.kind === "income" ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span className="flex-1 text-[13px] text-gray-900 truncate">
                {e.name}
              </span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${
                  e.kind === "income" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {e.kind === "income" ? "+" : "−"}
                {e.amount}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveExtra(e.id)}
                aria-label="Удалить"
                className="w-6 h-6 flex items-center justify-center text-gray-400 active:text-red-500"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          !showAdd && (
            <div className="px-4 py-2 text-[12px] text-gray-400">
              Нет дополнительных записей
            </div>
          )
        )}

        {/* Add extra form / button */}
        <div className="px-3 pt-2 pb-2">
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full h-9 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold active:scale-[0.98]"
            >
              <span className="text-[15px] leading-none">+</span>
              Добавить
            </button>
          ) : (
            <div className="bg-indigo-50 rounded-lg p-2 space-y-2">
              <div className="flex gap-1 bg-white rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setNewKind("expense")}
                  className={`flex-1 h-8 rounded text-[12px] font-semibold ${
                    newKind === "expense"
                      ? "bg-red-500 text-white"
                      : "text-gray-500"
                  }`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setNewKind("income")}
                  className={`flex-1 h-8 rounded text-[12px] font-semibold ${
                    newKind === "income"
                      ? "bg-emerald-500 text-white"
                      : "text-gray-500"
                  }`}
                >
                  Доход
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название (например, Бензин)"
                className="w-full h-10 px-3 bg-white rounded-lg text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={newAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewAmount(v === "" ? "" : Number(v) || 0);
                  }}
                  placeholder="Сумма"
                  className="flex-1 h-10 px-3 bg-white rounded-lg text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[13px] text-gray-500">€</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setNewName("");
                    setNewAmount("");
                  }}
                  className="flex-1 h-9 text-[12px] text-gray-600 font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAddExtra}
                  disabled={
                    !newName.trim() ||
                    typeof newAmount !== "number" ||
                    newAmount <= 0
                  }
                  className="flex-1 h-9 bg-indigo-600 text-white rounded-lg text-[12px] font-semibold disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="border-t-2 border-gray-200 mt-1 pt-2 pb-1 px-4 space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-emerald-600">Итого доход</span>
            <span className="text-[13px] font-semibold text-emerald-600 tabular-nums">
              {totalIncome}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-red-600">Итого расход</span>
            <span className="text-[13px] font-semibold text-red-600 tabular-nums">
              {totalExpense}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
            <span className="text-[13px] font-semibold text-sky-600">Прибыль</span>
            <span className="text-[18px] font-bold text-sky-600 tabular-nums">
              {profit}
            </span>
          </div>
        </div>
      </div>
    </DialogModal>
  );
}
