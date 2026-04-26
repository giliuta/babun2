"use client";

import { useEffect, useRef, useState } from "react";
import type { AppointmentExpense } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { generateId } from "@babun/shared/local/masters";
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
          className="w-full h-11 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-[10px] font-semibold text-[15px] active:bg-[var(--accent-pressed)] active:scale-[0.98] transition"
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
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] rounded-[10px] text-[15px] font-semibold active:scale-[0.98]"
            >
              <span className="text-[15px] leading-none">+</span>
              Добавить расход
            </button>
          ) : (
            <div className="bg-[var(--accent-tint)] rounded-[10px] p-2 space-y-2">
              <input
                type="text"
                autoFocus
                value={newExpenseName}
                onChange={(e) => setNewExpenseName(e.target.value)}
                placeholder="Название (например, Материалы)"
                className="w-full h-11 px-3.5 bg-[var(--surface-card)] rounded-[10px] border border-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:border-[var(--accent)]"
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
                  className="flex-1 h-11 px-3.5 bg-[var(--surface-card)] rounded-[10px] border border-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[13px] text-[var(--label-secondary)]">€</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpense(false);
                    setNewExpenseName("");
                    setNewExpenseAmount("");
                  }}
                  className="flex-1 h-11 text-[13px] text-[var(--accent)] font-medium"
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
                  className="flex-1 h-11 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-[10px] text-[13px] font-semibold active:bg-[var(--accent-pressed)] disabled:opacity-40"
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
            <div className="px-3 py-3 text-center text-[12px] text-[var(--label-tertiary)]">
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
                  className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--separator)]"
                >
                  <div
                    className="w-1 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: service.color }}
                  />
                  <div className="flex-1 min-w-0 text-[15px] text-[var(--label)] truncate">
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
                      className="w-16 h-8 px-1 text-right text-[13px] font-semibold text-[var(--system-green)] bg-[rgba(52,199,89,0.1)] rounded-[6px] border border-[var(--system-green)] focus:outline-none tabular-nums"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(service.id, rowTotal)}
                      className={`text-[13px] font-semibold tabular-nums px-1.5 py-0.5 rounded active:bg-[rgba(52,199,89,0.1)] ${
                        isOverridden
                          ? "text-[var(--system-green)] underline decoration-dotted"
                          : "text-[var(--system-green)]"
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
                className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--separator)]"
              >
                <div className="w-1 h-5 rounded-full bg-[var(--system-red)] flex-shrink-0" />
                <div className="flex-1 min-w-0 text-[15px] text-[var(--label)] truncate">
                  {e.name}
                </div>
                <div className="text-[13px] font-semibold text-[var(--system-red)] tabular-nums">
                  −{e.amount}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(e.id)}
                  aria-label="Удалить"
                  className="w-6 h-6 flex items-center justify-center text-[var(--label-tertiary)] active:text-[var(--system-red)]"
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
        <div className="border-t border-[var(--separator-opaque)] mt-1.5 pt-1.5 pb-1 px-3 space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[var(--system-green)]">Доход</span>
            <span className="text-[15px] font-semibold text-[var(--system-green)] tabular-nums">
              {subtotal}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[13px] text-[var(--accent)]">Скидка</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={localDiscount}
                onChange={(e) =>
                  setLocalDiscount(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-12 h-7 px-1.5 bg-[var(--fill-tertiary)] rounded-[6px] text-[13px] text-[var(--label)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-right"
              />
              <div className="flex bg-[var(--fill-tertiary)] rounded-[6px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleDiscountMode("amount")}
                  className={`px-1.5 h-7 text-[12px] font-semibold ${
                    discountMode === "amount"
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  €
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscountMode("percent")}
                  className={`px-1.5 h-7 text-[12px] font-semibold ${
                    discountMode === "percent"
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <span className="text-[15px] font-semibold text-[var(--accent)] tabular-nums">
              −{clampedDiscount}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[var(--system-green)]">Итоговый доход</span>
            <span className="text-[15px] font-semibold text-[var(--system-green)] tabular-nums">
              {finalIncome}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[var(--system-red)]">Итоговый расход</span>
            <span className="text-[15px] font-semibold text-[var(--system-red)] tabular-nums">
              {totalExpenses}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1 border-t border-[var(--separator)]">
            <span className="text-[15px] font-semibold text-[var(--accent)]">Прибыль</span>
            <span className="text-[17px] font-bold text-[var(--accent)] tabular-nums">
              {profit}
            </span>
          </div>
        </div>
      </div>
    </DialogModal>
  );
}
