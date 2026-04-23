"use client";

// Sprint 033 Phase I32 — Master Salary subroute, iOS Settings style.
// Instant commit on blur. Some fields (hybrid %) show only when their
// parent model is selected, to keep the page compact.

import { use } from "react";
import { haptic } from "@/lib/haptics";
import { useMasters } from "@/app/dashboard/layout";
import {
  PAYMENT_METHOD_LABELS,
  SALARY_MODEL_HINTS,
  SALARY_MODEL_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_UNIT,
  type Master,
  type MasterSalary,
  type PaymentMethod,
  type SalaryModel,
  type SalaryPeriod,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

const MODEL_ORDER: SalaryModel[] = [
  "percent_of_team",
  "percent_of_own",
  "per_visit",
  "monthly",
  "hourly",
  "hybrid",
  "none",
];

const PERIOD_ORDER: SalaryPeriod[] = ["weekly", "biweekly", "monthly"];
const METHOD_ORDER: PaymentMethod[] = ["cash", "card", "bank_transfer", "other"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterSalaryPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters, upsertMaster } = useMasters();
  const master = masters.find((m) => m.id === id);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Зарплата" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const salary: MasterSalary = master.salary ?? {
    model: "percent_of_team",
    value: 0,
  };

  const patch = (diff: Partial<MasterSalary>) => {
    upsertMaster({
      ...master,
      salary: { ...salary, ...diff } as MasterSalary,
    });
  };

  const commitModel = (next: SalaryModel) => {
    if (next === salary.model) return;
    haptic("tap");
    patch({ model: next });
  };
  const commitPeriod = (next: SalaryPeriod) => {
    if (next === (salary.period ?? "monthly")) return;
    haptic("tap");
    patch({ period: next });
  };
  const commitMethod = (next: PaymentMethod) => {
    if (next === (salary.method ?? "cash")) return;
    haptic("tap");
    patch({ method: next });
  };

  const showValue =
    salary.model !== "none" && salary.model !== "percent_of_team";
  const valueUnit = SALARY_UNIT[salary.model];

  return (
    <MasterSectionShell masterId={id} title="Зарплата" hideSave>
      {/* ── Модель ───────────────────────────────────────────────── */}
      <Section title="Модель оплаты" footer={SALARY_MODEL_HINTS[salary.model]}>
        {MODEL_ORDER.map((m, i) => {
          const picked = salary.model === m;
          const last = i === MODEL_ORDER.length - 1;
          return (
            <button
              key={m}
              type="button"
              onClick={() => commitModel(m)}
              className={`w-full flex items-center justify-between gap-3 px-4 min-h-[48px] ${
                last ? "" : "border-b border-[var(--separator)]"
              } transition-colors ${
                picked ? "bg-[var(--accent-tint)]" : "active:bg-[var(--fill-quaternary)]"
              }`}
            >
              <span
                className={`text-[15px] text-left truncate ${
                  picked ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"
                }`}
              >
                {SALARY_MODEL_LABELS[m]}
              </span>
              {picked && (
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--label-on-accent)] text-[11px] font-bold shrink-0">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </Section>

      {/* ── Сумма ────────────────────────────────────────────────── */}
      {showValue && (
        <Section title="Сумма">
          <NumberRow
            label="Значение"
            value={salary.value}
            unit={valueUnit}
            onCommit={(n) => patch({ value: n })}
          />
          {salary.model === "hybrid" && (
            <NumberRow
              label="% от своих работ"
              value={salary.hybrid_percent ?? 0}
              unit="%"
              onCommit={(n) => patch({ hybrid_percent: n })}
            />
          )}
        </Section>
      )}

      {/* ── Бонусы и удержания ───────────────────────────────────── */}
      {salary.model !== "none" && (
        <Section
          title="Бонусы и удержания"
          footer="Необязательные суммы поверх основной модели."
        >
          <NumberRow
            label="Фикс. бонус"
            value={salary.fixed_bonus ?? 0}
            unit="€"
            onCommit={(n) => patch({ fixed_bonus: n || undefined })}
          />
          <NumberRow
            label="Удержание"
            value={salary.deduction ?? 0}
            unit="€"
            onCommit={(n) => patch({ deduction: n || undefined })}
            last
          />
        </Section>
      )}

      {/* ── Период ───────────────────────────────────────────────── */}
      {salary.model !== "none" && (
        <Section title="Когда платим">
          <div className="p-2 grid grid-cols-3 gap-2">
            {PERIOD_ORDER.map((p) => {
              const picked = (salary.period ?? "monthly") === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => commitPeriod(p)}
                  className={`h-10 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                    picked
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                  }`}
                >
                  {SALARY_PERIOD_LABELS[p]}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Метод ────────────────────────────────────────────────── */}
      {salary.model !== "none" && (
        <Section title="Как платим">
          <div className="p-2 grid grid-cols-2 gap-2">
            {METHOD_ORDER.map((m) => {
              const picked = (salary.method ?? "cash") === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => commitMethod(m)}
                  className={`h-10 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                    picked
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Заметка ──────────────────────────────────────────────── */}
      {salary.model !== "none" && (
        <Section title="Примечание">
          <div className="px-4 py-2">
            <textarea
              value={salary.note ?? ""}
              onChange={(e) => {
                upsertMaster({
                  ...master,
                  salary: { ...salary, note: e.target.value } as MasterSalary,
                });
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (salary.note ?? "")) return;
                patch({ note: v || undefined });
              }}
              placeholder="Например, «авансы по средам» или «минус 50€ за аренду инструмента»"
              rows={3}
              maxLength={400}
              className="w-full bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug py-1"
            />
          </div>
        </Section>
      )}
    </MasterSectionShell>
  );
}

function Section({
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
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
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
  onCommit,
  last,
}: {
  label: string;
  value: number;
  unit: string;
  onCommit: (n: number) => void;
  last?: boolean;
}) {
  // Text-mode numeric: empty string shows when value is zero so the
  // placeholder remains visible; prevents the "can't delete 2 to type
  // 3" bug we hit on the services editor.
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[15px] text-[var(--label)] flex-1">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={value === 0 ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          const parsed = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(parsed)) return;
          onCommit(parsed);
        }}
        onBlur={(e) => {
          const raw = e.target.value.replace(",", ".");
          const parsed = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(parsed)) return;
          onCommit(parsed);
        }}
        placeholder="0"
        className="w-24 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
      />
      {unit && (
        <span className="text-[13px] text-[var(--label-secondary)] w-8 text-right shrink-0">
          {unit}
        </span>
      )}
    </label>
  );
}
