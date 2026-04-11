"use client";

import { useEffect, useRef, useState } from "react";
import type { AppointmentExpense } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { generateId } from "@/lib/masters";
import DialogModal from "./DialogModal";

interface FinanceSheetProps {
  open: boolean;
  onClose: () => void;
  services: { service: Service; qty: number }[];
  discount: number;
  expenses: AppointmentExpense[];
  priceOverrides: Record<string, number>; // id → per-unit override
  onConfirm: (next: {
    discount: number;
    expenses: AppointmentExpense[];
    priceOverrides: Record<string, number>;
  }) => void;
}

export default function FinanceSheet({
  open,
  onClose,
  services,
  discount,
  expenses,
  priceOverrides,
  onConfirm,
}: FinanceSheetProps) {
  const [localDiscount, setLocalDiscount] = useState(discount);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [localExpenses, setLocalExpenses] = useState<AppointmentExpense[]>(expenses);
  const [localOverrides, setLocalOverrides] =
    useState<Record<string, number>>(priceOverrides);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | "">("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocalDiscount(discount);
      setLocalExpenses(expenses);
      setLocalOverrides(priceOverrides);
      setDiscountMode("amount");
      setNewExpenseName("");
      setNewExpenseAmount("");
      setShowAddExpense(false);
      setEditingServiceId(null);
    }
  }, [open, discount, expenses, priceOverrides]);

  useEffect(() => {
    if (editingServiceId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingServiceId]);

  // Row price: uses override if present, otherwise the base service price.
  const unitPriceFor = (s: Service): number =>
    localOverrides[s.id] !== undefined ? localOverrides[s.id] : s.price;

  const subtotal = services.reduce(
    (sum, { service, qty }) => sum + unitPriceFor(service) * qty,
    0
  );

  const discountValue =
    discountMode === "percent"
      ? Math.round((localDiscount / 100) * subtotal)
      : localDiscount;
  const clampedDiscount = Math.min(discountValue, subtotal);

  const finalIncome = Math.max(0, subtotal - clampedDiscount);
  const totalExpenses = localExpenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = finalIncome - totalExpenses;

  const handleDiscountMode = (next: "amount" | "percent") => {
    if (next === discountMode) return;
    if (next === "percent") {
      const pct = subtotal > 0 ? Math.round((localDiscount / subtotal) * 100) : 0;
      setLocalDiscount(pct);
    } else {
      setLocalDiscount(Math.round((localDiscount / 100) * subtotal));
    }
    setDiscountMode(next);
  };

  const startEdit = (serviceId: string, rowTotal: number) => {
    setEditingServiceId(serviceId);
    setEditValue(String(rowTotal));
  };

  const commitEdit = () => {
    if (!editingServiceId) return;
    const entry = services.find((e) => e.service.id === editingServiceId);
    if (!entry) {
      setEditingServiceId(null);
      return;
    }
    const newTotal = Math.max(0, parseFloat(editValue) || 0);
    const baseRowTotal = entry.service.price * entry.qty;
    setLocalOverrides((prev) => {
      const next = { ...prev };
      if (newTotal === baseRowTotal) {
        delete next[entry.service.id];
      } else {
        next[entry.service.id] = entry.qty > 0 ? newTotal / entry.qty : newTotal;
      }
      return next;
    });
    setEditingServiceId(null);
  };

  const cancelEdit = () => setEditingServiceId(null);

  const handleAddExpense = () => {
    const name = newExpenseName.trim();
    const amount = typeof newExpenseAmount === "number" ? newExpenseAmount : 0;
    if (!name || amount <= 0) return;
    setLocalExpenses((prev) => [
      ...prev,
      { id: generateId("exp"), name, amount },
    ]);
    setNewExpenseName("");
    setNewExpenseAmount("");
    setShowAddExpense(false);
  };

  const handleRemoveExpense = (id: string) => {
    setLocalExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConfirm = () => {
    onConfirm({
      discount: clampedDiscount,
      expenses: localExpenses,
      priceOverrides: localOverrides,
    });
    onClose();
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Доходы и расходы"
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
        {/* Add expense */}
        <div className="px-3 pt-3 pb-2">
          {!showAddExpense ? (
            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="w-full h-9 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold active:scale-[0.98]"
            >
              <span className="text-[15px] leading-none">+</span>
              Добавить расход
            </button>
          ) : (
            <div className="bg-indigo-50 rounded-lg p-2 space-y-2">
              <input
                type="text"
                autoFocus
                value={newExpenseName}
                onChange={(e) => setNewExpenseName(e.target.value)}
                placeholder="Название (например, Материалы)"
                className="w-full h-10 px-3 bg-white rounded-lg text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={newExpenseAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewExpenseAmount(v === "" ? "" : Number(v) || 0);
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
                    setShowAddExpense(false);
                    setNewExpenseName("");
                    setNewExpenseAmount("");
                  }}
                  className="flex-1 h-9 text-[12px] text-gray-600 font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAddExpense}
                  disabled={
                    !newExpenseName.trim() ||
                    typeof newExpenseAmount !== "number" ||
                    newExpenseAmount <= 0
                  }
                  className="flex-1 h-9 bg-indigo-600 text-white rounded-lg text-[12px] font-semibold disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Services */}
        <div>
          {services.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-gray-400">
              Услуги не выбраны
            </div>
          ) : (
            services.map(({ service, qty }) => {
              const unit = unitPriceFor(service);
              const rowTotal = unit * qty;
              const isEditing = editingServiceId === service.id;
              const isOverridden = localOverrides[service.id] !== undefined;
              return (
                <div
                  key={service.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100"
                >
                  <div
                    className="w-1 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: service.color }}
                  />
                  <div className="flex-1 min-w-0 text-[13px] text-gray-900 truncate">
                    {qty > 1 ? `${service.name} ×${qty}` : service.name}
                  </div>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="number"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-16 h-7 px-1 text-right text-[13px] font-semibold text-emerald-600 bg-emerald-50 rounded border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(service.id, rowTotal)}
                      className={`text-[13px] font-semibold tabular-nums px-1.5 py-0.5 rounded active:bg-emerald-50 ${
                        isOverridden
                          ? "text-emerald-600 underline decoration-dotted"
                          : "text-emerald-600"
                      }`}
                    >
                      +{rowTotal}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Expenses */}
        {localExpenses.length > 0 && (
          <div>
            {localExpenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100"
              >
                <div className="w-1 h-5 rounded-full bg-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-[13px] text-gray-900 truncate">
                  {e.name}
                </div>
                <div className="text-[13px] font-semibold text-red-600 tabular-nums">
                  −{e.amount}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(e.id)}
                  aria-label="Удалить"
                  className="w-6 h-6 flex items-center justify-center text-gray-400 active:text-red-500"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="border-t-2 border-gray-200 mt-1.5 pt-1.5 pb-1 px-3 space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-emerald-600">Доход</span>
            <span className="text-[13px] font-semibold text-emerald-600 tabular-nums">
              {subtotal}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[12px] text-indigo-600">Скидка</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={localDiscount}
                onChange={(e) =>
                  setLocalDiscount(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-12 h-7 px-1.5 bg-gray-100 rounded text-[12px] text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
              />
              <div className="flex bg-gray-100 rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleDiscountMode("amount")}
                  className={`px-1.5 h-7 text-[11px] font-semibold ${
                    discountMode === "amount"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-500"
                  }`}
                >
                  €
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscountMode("percent")}
                  className={`px-1.5 h-7 text-[11px] font-semibold ${
                    discountMode === "percent"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-500"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <span className="text-[13px] font-semibold text-indigo-600 tabular-nums">
              −{clampedDiscount}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-emerald-600">Итоговый доход</span>
            <span className="text-[13px] font-semibold text-emerald-600 tabular-nums">
              {finalIncome}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-red-600">Итоговый расход</span>
            <span className="text-[13px] font-semibold text-red-600 tabular-nums">
              {totalExpenses}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
            <span className="text-[13px] font-semibold text-sky-600">Прибыль</span>
            <span className="text-[17px] font-bold text-sky-600 tabular-nums">
              {profit}
            </span>
          </div>
        </div>
      </div>
    </DialogModal>
  );
}
