"use client";

// P0 #15 (CRM Core brief) — manual transaction sheet.
//
// Operators routinely need to log a one-off cash income or out-of-pocket
// expense that didn't come from an appointment (чаевые, заправка,
// canteen, mid-day market run for an extra filter). Before this sheet
// the only path was tapping the day's footer in /close-day and editing
// the day-extras list — too many steps for «I'm holding €20 cash, where
// do I put it».
//
// This component is a bottom-sheet form anchored to a FAB on /finances.
// It appends a row to the existing `babun-day-extras` store (one map
// keyed by `teamId:date`), so finance summaries pick it up immediately
// via the existing `useFinanceData` pipeline.
//
// Scope intentionally narrower than the brief:
//   • No «transfer» kind — would need a from/to team picker; deferred.
//   • No client / appointment linking — those couplings belong in the
//     appointment payment block (see P0 #13 once Supabase lands).
// The bottom-sheet is structured so adding those rows later is just
// extra fields + reducer cases.

import { useMemo, useState } from "react";
import { X } from "@babun/shared/icons";
import { Button } from "@/components/ui";
import {
  type DayExtra,
  type DayExtraKind,
  type ExpenseCategoryKey,
} from "@babun/shared/local/day-extras";
import { generateId } from "@babun/shared/local/masters";
import { haptic } from "@/lib/haptics";

interface TeamOption {
  id: string;
  name: string;
}

interface ManualTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  teams: TeamOption[];
  /** Pre-selected team — usually the page's `activeTeam` so the user
   *  isn't forced to re-pick. Empty string = unspecified (operator
   *  hasn't focused a team filter yet). */
  defaultTeamId: string;
  /** Read the day-extras list for (teamId, dateKey). */
  getExtrasFor: (teamId: string | null, dateKey: string) => DayExtra[];
  /** Persist the updated list for (teamId, dateKey). */
  setExtrasFor: (teamId: string, dateKey: string, extras: DayExtra[]) => void;
}

const EXPENSE_CATEGORIES: { key: ExpenseCategoryKey; label: string }[] = [
  { key: "fuel", label: "Топливо" },
  { key: "food", label: "Еда" },
  { key: "supplies", label: "Материалы" },
  { key: "other", label: "Иное" },
];

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ManualTransactionSheet({
  open,
  onClose,
  teams,
  defaultTeamId,
  getExtrasFor,
  setExtrasFor,
}: ManualTransactionSheetProps) {
  const [kind, setKind] = useState<DayExtraKind>("income");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  // «all» bucket can't own a real persisted entry — pick the first
  // team as a safer default.
  const sanitizedDefault =
    defaultTeamId && teams.some((t) => t.id === defaultTeamId)
      ? defaultTeamId
      : teams[0]?.id ?? "";
  const [teamId, setTeamId] = useState<string>(sanitizedDefault);
  const [dateKey, setDateKey] = useState<string>(todayKey());
  const [category, setCategory] = useState<ExpenseCategoryKey>("other");

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);

  const canSave =
    open && numericAmount > 0 && name.trim().length > 0 && teamId !== "";

  if (!open) return null;

  const handleSave = () => {
    if (!canSave) return;
    haptic("success");
    const entry: DayExtra = {
      id: generateId("xtra"),
      name: name.trim(),
      amount: numericAmount,
      kind,
      ...(kind === "expense" ? { category } : {}),
    };
    const existing = getExtrasFor(teamId, dateKey);
    setExtrasFor(teamId, dateKey, [...existing, entry]);
    // Reset form for a follow-up entry; close.
    setAmount("");
    setName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] sm:items-center">
      <div className="w-full sm:max-w-md bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Новая транзакция
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Kind toggle */}
          <div className="grid grid-cols-2 gap-2">
            <KindChip
              label="Доход"
              active={kind === "income"}
              tone="income"
              onClick={() => setKind("income")}
            />
            <KindChip
              label="Расход"
              active={kind === "expense"}
              tone="expense"
              onClick={() => setKind("expense")}
            />
          </div>

          <Field label="Сумма (€)" required>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputCls + " tabular-nums"}
              autoFocus
            />
          </Field>

          <Field label="Описание" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kind === "income" ? "Чаевые, продажа фильтра, ..." : "Заправка, обед, материалы, ..."
              }
              className={inputCls}
            />
          </Field>

          {kind === "expense" && (
            <Field label="Категория">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategoryKey)}
                className={inputCls}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Команда" required>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={inputCls}
            >
              {teams.length === 0 && (
                <option value="">— нет команд —</option>
              )}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Дата">
            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className={inputCls}
            />
          </Field>

          <p className="text-[12px] text-[var(--label-tertiary)] leading-snug pt-1">
            Запишется в дневной журнал команды. Появится в общем итоге и в
            закрытии дня.
          </p>
        </div>

        <div className="border-t border-[var(--separator)] px-4 py-3 flex gap-2 bg-[var(--surface-card)]">
          <Button variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!canSave}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

function KindChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "income" | "expense";
  onClick: () => void;
}) {
  const activeCls =
    tone === "income"
      ? "bg-[rgba(52,199,89,0.16)] text-[var(--system-green)] border-[rgba(52,199,89,0.4)]"
      : "bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] border-[rgba(255,59,48,0.3)]";
  const idleCls =
    "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] border-transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-[12px] text-[14px] font-semibold border transition active:scale-[0.98] ${
        active ? activeCls : idleCls
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-[var(--system-red)] ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";
