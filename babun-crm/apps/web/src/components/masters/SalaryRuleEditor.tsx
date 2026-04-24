"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  PERCENT_SOURCE_LABELS,
  REVENUE_BASIS_LABELS,
  SALARY_PERIOD_LABELS,
  type PaymentMethod,
  type PercentSource,
  type RevenueBasis,
  type SalaryPeriod,
  type SalaryRule,
  type Team,
} from "@/lib/masters";
import { haptic } from "@/lib/haptics";

interface SalaryRuleEditorProps {
  open: boolean;
  rule: SalaryRule | null;
  brigade: Team | null;
  onSave: (rule: SalaryRule) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const PERIOD_ORDER: SalaryPeriod[] = ["weekly", "biweekly", "monthly"];
const METHOD_ORDER: PaymentMethod[] = ["cash", "card", "bank_transfer", "other"];

// Full-screen on mobile, centered sheet on desktop. Tight iOS
// Settings look — grouped cards, no scroll-chrome.
export default function SalaryRuleEditor({
  open,
  rule,
  brigade,
  onSave,
  onDelete,
  onClose,
}: SalaryRuleEditorProps) {
  const [draft, setDraft] = useState<SalaryRule | null>(rule);

  useEffect(() => {
    setDraft(rule);
  }, [rule, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const patch = (diff: Partial<SalaryRule>) => {
    setDraft({ ...draft, ...diff });
  };

  const save = () => {
    haptic("tap");
    onSave(draft);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-tight text-[var(--label)] truncate">
              Правило ЗП
            </div>
            {brigade && (
              <div className="text-[12px] text-[var(--label-secondary)] flex items-center gap-1.5 mt-0.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: brigade.color }}
                />
                Бригада «{brigade.name}»
              </div>
            )}
            {!brigade && (
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
                Общее правило (без привязки к бригаде)
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 bg-[var(--surface-grouped)]">
          {/* ── Фикс. ставка ─────────────────────────────────── */}
          <Group
            title="Ставка"
            footer="Гарантированная сумма каждого периода, независимо от объёма работ."
          >
            <NumberRow
              label="Ставка"
              value={draft.base_amount}
              unit="€"
              onChange={(n) => patch({ base_amount: n })}
              last
            />
          </Group>

          {/* ── Процент ──────────────────────────────────────── */}
          <Group
            title="Процент"
            footer="Начисляется сверху ставки. Выбери, от чего считать и какую базу брать."
          >
            <NumberRow
              label="Процент"
              value={draft.percent_rate}
              unit="%"
              onChange={(n) => patch({ percent_rate: n })}
            />
            <SegmentRow
              label="От чего"
              options={(["team", "own"] as PercentSource[]).map((v) => ({
                value: v,
                label: PERCENT_SOURCE_LABELS[v],
              }))}
              value={draft.percent_source}
              disabled={draft.percent_rate <= 0}
              onChange={(v) => patch({ percent_source: v as PercentSource })}
            />
            <SegmentRow
              label="База"
              options={(["gross", "net"] as RevenueBasis[]).map((v) => ({
                value: v,
                label: REVENUE_BASIS_LABELS[v],
              }))}
              value={draft.percent_of}
              disabled={draft.percent_rate <= 0}
              onChange={(v) => patch({ percent_of: v as RevenueBasis })}
              last
            />
          </Group>

          {/* ── За визит / почасовая ─────────────────────────── */}
          <Group
            title="Переменные надбавки"
            footer="Доплачиваются за факт работы. Оба поля опциональны."
          >
            <NumberRow
              label="За визит"
              value={draft.per_visit}
              unit="€"
              onChange={(n) => patch({ per_visit: n })}
            />
            <NumberRow
              label="За час"
              value={draft.hourly_rate}
              unit="€/ч"
              onChange={(n) => patch({ hourly_rate: n })}
              last
            />
          </Group>

          {/* ── Бонус / удержание ────────────────────────────── */}
          <Group title="Бонус и удержание">
            <NumberRow
              label="Бонус"
              value={draft.fixed_bonus ?? 0}
              unit="€"
              onChange={(n) => patch({ fixed_bonus: n || undefined })}
            />
            <NumberRow
              label="Удержание"
              value={draft.deduction ?? 0}
              unit="€"
              onChange={(n) => patch({ deduction: n || undefined })}
              last
            />
          </Group>

          {/* ── Когда / чем ─────────────────────────────────── */}
          <Group title="Период и способ">
            <div className="px-4 py-2 border-b border-[var(--separator)]">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Когда
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PERIOD_ORDER.map((p) => (
                  <ChipButton
                    key={p}
                    active={(draft.period ?? "monthly") === p}
                    onClick={() => patch({ period: p })}
                  >
                    {SALARY_PERIOD_LABELS[p]}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div className="px-4 py-2">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Чем
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {METHOD_ORDER.map((m) => (
                  <ChipButton
                    key={m}
                    active={(draft.method ?? "cash") === m}
                    onClick={() => patch({ method: m })}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </ChipButton>
                ))}
              </div>
            </div>
          </Group>

          {/* ── Примечание ───────────────────────────────────── */}
          <Group title="Примечание">
            <div className="px-3 py-2">
              <textarea
                value={draft.note ?? ""}
                onChange={(e) => patch({ note: e.target.value })}
                placeholder="Напр. «авансы по средам» или «минус 50€ за инструмент»"
                rows={2}
                maxLength={400}
                className="w-full bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
              />
            </div>
          </Group>

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                haptic("warning");
                onDelete();
              }}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] text-[var(--system-red)] text-[14px] font-medium active:bg-[rgba(255,59,48,0.08)]"
            >
              <Trash2 size={15} strokeWidth={2} />
              Удалить правило
            </button>
          )}
        </div>

        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
          }}
        >
          <button
            type="button"
            onClick={save}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-1 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

function NumberRow({
  label,
  value,
  unit,
  onChange,
  last,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (n: number) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[14px] text-[var(--label)] flex-1">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={value === 0 ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          const parsed = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(parsed)) return;
          onChange(parsed);
        }}
        placeholder="0"
        className="w-24 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
      />
      <span className="text-[13px] text-[var(--label-secondary)] w-10 text-right shrink-0">
        {unit}
      </span>
    </label>
  );
}

function SegmentRow({
  label,
  options,
  value,
  disabled,
  onChange,
  last,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  last?: boolean;
}) {
  return (
    <div
      className={`px-4 py-2 ${
        last ? "" : "border-b border-[var(--separator)]"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
        {label}
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <ChipButton
            key={o.value}
            active={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </ChipButton>
        ))}
      </div>
    </div>
  );
}

function ChipButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (!active) haptic("tap");
        onClick();
      }}
      className={`h-9 rounded-[10px] text-[12px] font-semibold press-scale transition-colors disabled:opacity-50 disabled:pointer-events-none ${
        active
          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
          : "bg-[var(--fill-tertiary)] text-[var(--label)]"
      }`}
    >
      {children}
    </button>
  );
}
