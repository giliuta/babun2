"use client";

// Salary page — rewritten v305 for max convenience.
//
// Layout goals:
//  · Big summary pill at the top that translates the config into one
//    line the owner can read at a glance («30% от прибыли · раз в
//    месяц · нал»), plus a rough monthly money estimate when we have
//    the data to compute one.
//  · Core config collapsed into ONE card: model (tap → picker sheet),
//    amount, period, method. No cascading sub-sections.
//  · Бонусы / удержания / примечание stay on the same page but in
//    one compact «Ещё» card.
//  · Банк и реквизиты appear only when method = «Банковский перевод»
//    — 90% of small-biz payouts are cash, no reason to see IBAN/TIN.

import { use, useEffect, useMemo, useState } from "react";
import { ChevronRight, Wallet } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useAppointments, useMasters, useTeams } from "@/app/dashboard/layout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  PAYMENT_METHOD_LABELS,
  SALARY_MODEL_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_UNIT,
  appendAudit,
  getTeamLeadIds,
  type MasterSalary,
  type PaymentMethod,
  type SalaryModel,
  type SalaryPeriod,
  type Team,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";
import SalaryModelPickerSheet from "@/components/masters/SalaryModelPickerSheet";
import { formatEUR } from "@/lib/money";

const PERIOD_ORDER: SalaryPeriod[] = ["weekly", "biweekly", "monthly"];
const METHOD_ORDER: PaymentMethod[] = ["cash", "card", "bank_transfer", "other"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterSalaryPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters, upsertMaster } = useMasters();
  const { teams } = useTeams();
  const { appointments } = useAppointments();
  const [pickerOpen, setPickerOpen] = useState(false);

  const master = masters.find((m) => m.id === id);

  // Teams this master is a member of — needed for `percent_of_team`
  // preview. Uses the same logic as the hub page.
  const assignedTeams = useMemo<Team[]>(() => {
    if (!master) return [];
    const seen = new Map<string, Team>();
    if (master.team_id) {
      const t = teams.find((x) => x.id === master.team_id);
      if (t) seen.set(t.id, t);
    }
    for (const t of teams) {
      const leadIds = getTeamLeadIds(t);
      if (leadIds.includes(master.id) || t.helper_ids.includes(master.id)) {
        if (!seen.has(t.id)) seen.set(t.id, t);
      }
    }
    return Array.from(seen.values());
  }, [master, teams]);

  const salary: MasterSalary = master?.salary ?? {
    model: "percent_of_team",
    value: 0,
  };

  // Rough monthly-earnings estimate from current-month completed
  // visits. Not a contractual number — just a sanity check so the
  // owner sees «≈ 850 €/мес» next to whatever they typed.
  const monthlyEstimate = useMemo(() => {
    if (!master) return null;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const teamIds = new Set(assignedTeams.map((t) => t.id));
    let personalRevenue = 0;
    let teamRevenue = 0;
    let visits = 0;
    for (const a of appointments) {
      if (a.status !== "completed") continue;
      if (!a.date.startsWith(ym)) continue;
      if (!a.team_id || !teamIds.has(a.team_id)) continue;
      teamRevenue += a.total_amount ?? 0;
      if (a.master_id === master.id) {
        personalRevenue += a.total_amount ?? 0;
        visits += 1;
      }
    }
    const base =
      salary.model === "monthly"
        ? salary.value
        : salary.model === "per_visit"
          ? salary.value * visits
          : salary.model === "percent_of_own"
            ? personalRevenue * (salary.value / 100)
            : salary.model === "percent_of_team"
              ? teamRevenue * (salary.value / 100)
              : salary.model === "hybrid"
                ? salary.value + personalRevenue * ((salary.hybrid_percent ?? 0) / 100)
                : 0;
    const delta = (salary.fixed_bonus ?? 0) - (salary.deduction ?? 0);
    const total = Math.max(0, Math.round(base + delta));
    if (salary.model === "none" || salary.model === "hourly") return null;
    if (total === 0) return null;
    return total;
  }, [appointments, assignedTeams, master, salary]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Зарплата" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const patch = (diff: Partial<MasterSalary>) => {
    upsertMaster({
      ...master,
      salary: { ...salary, ...diff } as MasterSalary,
    });
  };

  const commitModel = (next: SalaryModel) => {
    if (next === salary.model) return;
    const before = SALARY_MODEL_LABELS[salary.model];
    const after = SALARY_MODEL_LABELS[next];
    upsertMaster(
      appendAudit(
        { ...master, salary: { ...salary, model: next } as MasterSalary },
        {
          action: "salary_changed",
          summary: `Модель ЗП: «${before}» → «${after}»`,
        },
      ),
    );
  };

  const period: SalaryPeriod = salary.period ?? "monthly";
  const method: PaymentMethod = salary.method ?? "cash";
  const showValue = salary.model !== "none";
  const valueUnit = SALARY_UNIT[salary.model];
  const showBank = method === "bank_transfer" || method === "card";

  // Summary line translating current config into plain Russian.
  const summaryLine = (() => {
    const parts: string[] = [];
    if (salary.model === "none") {
      parts.push("Без ЗП в Babun");
    } else if (salary.model === "percent_of_team") {
      parts.push(
        salary.value > 0
          ? `${salary.value}% прибыли бригады`
          : SALARY_MODEL_LABELS[salary.model],
      );
    } else if (salary.model === "percent_of_own") {
      parts.push(
        salary.value > 0 ? `${salary.value}% своих работ` : "% своих работ",
      );
    } else if (salary.model === "per_visit") {
      parts.push(
        salary.value > 0
          ? `${formatEUR(salary.value)} за визит`
          : "за каждый визит",
      );
    } else if (salary.model === "monthly") {
      parts.push(
        salary.value > 0 ? `${formatEUR(salary.value)}/мес` : "оклад в месяц",
      );
    } else if (salary.model === "hourly") {
      parts.push(
        salary.value > 0 ? `${formatEUR(salary.value)}/ч` : "почасовая",
      );
    } else if (salary.model === "hybrid") {
      const base = salary.value > 0 ? `${formatEUR(salary.value)}/мес` : "оклад";
      const hp = salary.hybrid_percent ?? 0;
      parts.push(hp > 0 ? `${base} + ${hp}% своих` : base);
    }
    if (salary.model !== "none") {
      parts.push(SALARY_PERIOD_LABELS[period].toLowerCase());
      parts.push(PAYMENT_METHOD_LABELS[method].toLowerCase());
    }
    return parts.join(" · ");
  })();

  return (
    <MasterSectionShell masterId={id} title="Зарплата" hideSave>
      {/* ── Summary pill ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[var(--accent-tint)] to-[var(--surface-card)] border border-[var(--accent-tint)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3 flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shrink-0">
          <Wallet size={18} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[var(--label)] leading-tight">
            {summaryLine}
          </div>
          {monthlyEstimate !== null && (
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 tabular-nums">
              ≈ {formatEUR(monthlyEstimate)} за этот месяц · по факту визитов
            </div>
          )}
          {monthlyEstimate === null && salary.model !== "none" && (
            <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
              Оценка посчитается когда появятся закрытые визиты
            </div>
          )}
        </div>
      </div>

      {/* ── Main config: model + amount + period + method ──────── */}
      <Section title="Оплата">
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setPickerOpen(true);
          }}
          className="w-full flex items-center gap-3 min-h-[48px] px-4 active:bg-[var(--fill-quaternary)] transition"
        >
          <span className="text-[15px] text-[var(--label)] flex-1 text-left">
            Модель
          </span>
          <span className="text-[14px] text-[var(--label-secondary)] text-right truncate max-w-[60%]">
            {SALARY_MODEL_LABELS[salary.model]}
          </span>
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="text-[var(--label-quaternary)] shrink-0"
          />
        </button>

        {showValue && salary.model !== "percent_of_team" && (
          <NumberRow
            label={salary.model === "hybrid" ? "Оклад" : "Значение"}
            value={salary.value}
            unit={valueUnit}
            onCommit={(n) => patch({ value: n })}
          />
        )}

        {salary.model === "percent_of_team" && (
          <NumberRow
            label="Процент"
            value={salary.value}
            unit="%"
            onCommit={(n) => patch({ value: n })}
          />
        )}

        {salary.model === "hybrid" && (
          <NumberRow
            label="% своих работ"
            value={salary.hybrid_percent ?? 0}
            unit="%"
            onCommit={(n) => patch({ hybrid_percent: n })}
          />
        )}

        {salary.model !== "none" && (
          <>
            <div className="px-4 py-2 border-t border-[var(--separator)]">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Когда
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PERIOD_ORDER.map((p) => {
                  const picked = period === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        if (picked) return;
                        haptic("tap");
                        patch({ period: p });
                      }}
                      className={`h-9 rounded-[10px] text-[12px] font-semibold press-scale transition-colors ${
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
            </div>

            <div className="px-4 py-2 border-t border-[var(--separator)]">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Чем
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {METHOD_ORDER.map((m) => {
                  const picked = method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        if (picked) return;
                        haptic("tap");
                        patch({ method: m });
                      }}
                      className={`h-9 rounded-[10px] text-[13px] font-semibold press-scale transition-colors ${
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
            </div>
          </>
        )}
      </Section>

      {/* ── Bonus / deduction / note ─────────────────────────── */}
      {salary.model !== "none" && (
        <Section
          title="Бонусы, удержания, примечание"
          footer="Все поля опциональны. Применяются поверх основной модели."
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
          />
          <div className="px-4 py-2 border-t border-[var(--separator)]">
            <textarea
              value={salary.note ?? ""}
              onChange={(e) =>
                upsertMaster({
                  ...master,
                  salary: { ...salary, note: e.target.value } as MasterSalary,
                })
              }
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (salary.note ?? "")) return;
                patch({ note: v || undefined });
              }}
              placeholder="Напр. «авансы по средам» или «минус 50€ за аренду инструмента»"
              rows={2}
              maxLength={400}
              className="w-full bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
            />
          </div>
        </Section>
      )}

      {/* ── Bank details — only for electronic payouts ─────────── */}
      {showBank && (
        <Section
          title="Банк и реквизиты"
          footer="Появляются только для безнала. «Резидент Кипра» влияет на VAT в payroll."
        >
          <TextFieldRow
            label="IBAN"
            value={salary.iban ?? ""}
            placeholder="CY__ ____ ____ ____"
            onCommit={(v) => patch({ iban: v.trim() || undefined })}
          />
          <TextFieldRow
            label="Банк"
            value={salary.bank_name ?? ""}
            placeholder="Bank of Cyprus / Hellenic / Revolut"
            onCommit={(v) => patch({ bank_name: v.trim() || undefined })}
          />
          <TextFieldRow
            label="TIN / АФМ"
            value={salary.tax_number ?? ""}
            placeholder="Налоговый номер"
            onCommit={(v) => patch({ tax_number: v.trim() || undefined })}
          />
          <div className="flex items-center gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
            <span className="text-[15px] text-[var(--label)] flex-1">
              Резидент Кипра
            </span>
            <span className="text-[12px] text-[var(--label-tertiary)]">
              {salary.tax_resident ? "VAT 19%" : "не применять"}
            </span>
            <IOSSwitch
              checked={salary.tax_resident ?? false}
              onChange={(next) => patch({ tax_resident: next })}
              ariaLabel="Резидент Кипра"
            />
          </div>
        </Section>
      )}

      <SalaryModelPickerSheet
        open={pickerOpen}
        value={salary.model}
        onSelect={commitModel}
        onClose={() => setPickerOpen(false)}
      />
    </MasterSectionShell>
  );
}

// ─── Section + Row primitives ───────────────────────────────────

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
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

function TextFieldRow({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <label className="flex items-center gap-3 min-h-[44px] px-4 border-t border-[var(--separator)] first:border-t-0">
      <span className="text-[14px] text-[var(--label)] w-[100px] shrink-0">
        {label}
      </span>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          if (e.target.value !== value) onCommit(e.target.value);
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] text-right focus:outline-none"
        maxLength={80}
      />
    </label>
  );
}

function NumberRow({
  label,
  value,
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  onCommit: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] px-4 border-t border-[var(--separator)] first:border-t-0">
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
