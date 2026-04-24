"use client";

// Salary page — v306 per-brigade rules.
//
// Layout:
//  1. Totals pill: all rules summed (current-month estimate)
//  2. Per-brigade cards — one per SalaryRule. Tap opens editor.
//     Warning row for brigades the master is in without a rule.
//     Warning row for rules whose brigade was removed (orphans).
//  3. Bank / tax details (one set per master, shown when any rule
//     pays electronically).

import { use, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
  Wallet,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  useAppointments,
  useMasters,
  useTeams,
} from "@/app/dashboard/layout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  PAYMENT_METHOD_LABELS,
  SALARY_PERIOD_LABELS,
  appendAudit,
  blankSalaryRule,
  describeRule,
  estimateRuleMonthly,
  getTeamLeadIds,
  isRuleConfigured,
  type Master,
  type RuleEstimateContext,
  type SalaryRule,
  type Team,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";
import SalaryRuleEditor from "@/components/masters/SalaryRuleEditor";
import { formatEUR } from "@/lib/money";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RuleCard {
  rule: SalaryRule;
  brigade: Team | null;
  orphan: boolean;
  estimate: number;
  ctx: RuleEstimateContext;
}

export default function MasterSalaryPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters, upsertMaster } = useMasters();
  const { teams } = useTeams();
  const { appointments } = useAppointments();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SalaryRule | null>(null);

  const master = masters.find((m) => m.id === id);

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

  // Current-month revenue snapshots per brigade — fed into each
  // rule's monthly estimate.
  const monthCtxByBrigade = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, RuleEstimateContext>();
    if (!master) return map;
    for (const t of teams) {
      map.set(t.id, {
        ownGross: 0,
        teamGross: 0,
        ownExpenses: 0,
        teamExpenses: 0,
        visitsThisMonth: 0,
      });
    }
    for (const a of appointments) {
      if (a.status !== "completed") continue;
      if (!a.date.startsWith(ym)) continue;
      if (!a.team_id) continue;
      const bucket = map.get(a.team_id);
      if (!bucket) continue;
      const expensesTotal = (a.expenses ?? []).reduce(
        (s, e) => s + (e.amount || 0),
        0,
      );
      bucket.teamGross += a.total_amount ?? 0;
      bucket.teamExpenses += expensesTotal;
      if (a.master_id === master.id) {
        bucket.ownGross += a.total_amount ?? 0;
        bucket.ownExpenses += expensesTotal;
        bucket.visitsThisMonth += 1;
      }
    }
    return map;
  }, [appointments, master, teams]);

  const emptyCtx: RuleEstimateContext = {
    ownGross: 0,
    teamGross: 0,
    ownExpenses: 0,
    teamExpenses: 0,
    visitsThisMonth: 0,
  };

  const ruleCards = useMemo<RuleCard[]>(() => {
    if (!master) return [];
    const rules = master.salary_rules ?? [];
    return rules.map((r) => {
      const brigade = r.brigade_id
        ? (teams.find((t) => t.id === r.brigade_id) ?? null)
        : null;
      const ctx = r.brigade_id
        ? (monthCtxByBrigade.get(r.brigade_id) ?? emptyCtx)
        : emptyCtx;
      const orphan = r.brigade_id !== null && brigade === null;
      return {
        rule: r,
        brigade,
        orphan,
        estimate: estimateRuleMonthly(r, ctx),
        ctx,
      };
    });
  }, [master, teams, monthCtxByBrigade, emptyCtx]);

  // Brigades the master is in but has no rule for — yellow CTA rows.
  const unconfiguredBrigades = useMemo(() => {
    if (!master) return [] as Team[];
    const rules = master.salary_rules ?? [];
    const coveredIds = new Set(
      rules.map((r) => r.brigade_id).filter((x): x is string => !!x),
    );
    return assignedTeams.filter((t) => !coveredIds.has(t.id));
  }, [master, assignedTeams]);

  const totalEstimate = ruleCards.reduce((s, c) => s + c.estimate, 0);
  const showBank = (master?.salary_rules ?? []).some(
    (r) => r.method === "bank_transfer" || r.method === "card",
  );

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Зарплата" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const patchMaster = (diff: Partial<Master>) => {
    upsertMaster({ ...master, ...diff });
  };

  const saveRule = (next: SalaryRule) => {
    const rules = master.salary_rules ?? [];
    const exists = rules.some((r) => r.id === next.id);
    const updated = exists
      ? rules.map((r) => (r.id === next.id ? next : r))
      : [...rules, next];
    const brigadeName =
      teams.find((t) => t.id === next.brigade_id)?.name ?? "общее";
    upsertMaster(
      appendAudit(
        { ...master, salary_rules: updated },
        {
          action: "salary_changed",
          summary: exists
            ? `ЗП-правило обновлено · ${brigadeName} · ${describeRule(next)}`
            : `ЗП-правило добавлено · ${brigadeName} · ${describeRule(next)}`,
        },
      ),
    );
    setEditorOpen(false);
    setEditingRule(null);
  };

  const deleteRule = (ruleId: string) => {
    const rules = master.salary_rules ?? [];
    const target = rules.find((r) => r.id === ruleId);
    if (!target) return;
    const brigadeName =
      teams.find((t) => t.id === target.brigade_id)?.name ?? "общее";
    upsertMaster(
      appendAudit(
        { ...master, salary_rules: rules.filter((r) => r.id !== ruleId) },
        {
          action: "salary_changed",
          summary: `ЗП-правило удалено · ${brigadeName}`,
        },
      ),
    );
    setEditorOpen(false);
    setEditingRule(null);
  };

  const openExistingRule = (rule: SalaryRule) => {
    haptic("tap");
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const openNewRuleFor = (brigadeId: string | null) => {
    haptic("tap");
    setEditingRule(blankSalaryRule(brigadeId));
    setEditorOpen(true);
  };

  const editingBrigade = editingRule
    ? (teams.find((t) => t.id === editingRule.brigade_id) ?? null)
    : null;

  return (
    <MasterSectionShell masterId={id} title="Зарплата" hideSave>
      {/* ── Totals pill ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[var(--accent-tint)] to-[var(--surface-card)] border border-[var(--accent-tint)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3 flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shrink-0">
          <Wallet size={18} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          {ruleCards.length === 0 ? (
            <>
              <div className="text-[15px] font-semibold text-[var(--label)] leading-tight">
                ЗП ещё не настроена
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
                Добавь правило для бригады ниже
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold text-[var(--label)] leading-tight">
                {ruleCards.length === 1
                  ? "1 правило"
                  : `${ruleCards.length} правил${pluralSuffix(ruleCards.length)}`}
                {totalEstimate > 0 && (
                  <span className="text-[var(--label-secondary)] font-medium">
                    {" · ≈ "}
                    <span className="tabular-nums text-[var(--label)] font-semibold">
                      {formatEUR(totalEstimate)}
                    </span>
                  </span>
                )}
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
                {totalEstimate > 0
                  ? "оценка за этот месяц по факту визитов"
                  : "оценка появится когда пойдут закрытые визиты"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Rules list ──────────────────────────────────────── */}
      {ruleCards.length > 0 && (
        <div className="space-y-2">
          {ruleCards.map(({ rule, brigade, orphan, estimate }) => (
            <RuleCardView
              key={rule.id}
              rule={rule}
              brigade={brigade}
              orphan={orphan}
              estimate={estimate}
              onClick={() => openExistingRule(rule)}
            />
          ))}
        </div>
      )}

      {/* ── Add-rule CTAs for brigades without a rule ──────── */}
      {unconfiguredBrigades.length > 0 && (
        <div>
          <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
            Бригады без правила
          </div>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {unconfiguredBrigades.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openNewRuleFor(t.id)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] active:bg-[var(--fill-quaternary)] transition"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${t.color}22` }}
                >
                  <AlertTriangle
                    size={16}
                    strokeWidth={2}
                    className="text-[var(--system-yellow)] fill-[var(--system-yellow)]"
                  />
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[14px] font-semibold text-[var(--label)] truncate">
                    {t.name}
                  </span>
                  <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5">
                    Правило не настроено — тап, чтобы создать
                  </span>
                </span>
                <Plus size={16} strokeWidth={2.5} className="text-[var(--accent)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── «+ Правило без бригады» — only if master has no brigades
              (admin / universal). Otherwise always go through unconfigured
              list above for brigade-bound rules. */}
      {assignedTeams.length === 0 && (
        <button
          type="button"
          onClick={() => openNewRuleFor(null)}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--fill-quaternary)]"
        >
          <Plus size={16} strokeWidth={2.5} />
          Добавить правило
        </button>
      )}

      {/* ── Bank / tax (only when any rule pays electronically) ─ */}
      {showBank && (
        <div>
          <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
            Банк и реквизиты
          </div>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <BankTextRow
              label="IBAN"
              value={master.iban ?? ""}
              placeholder="CY__ ____ ____ ____"
              onCommit={(v) => patchMaster({ iban: v.trim() || undefined })}
            />
            <BankTextRow
              label="Банк"
              value={master.bank_name ?? ""}
              placeholder="Bank of Cyprus / Hellenic / Revolut"
              onCommit={(v) => patchMaster({ bank_name: v.trim() || undefined })}
            />
            <BankTextRow
              label="TIN / АФМ"
              value={master.tax_number ?? ""}
              placeholder="Налоговый номер"
              onCommit={(v) =>
                patchMaster({ tax_number: v.trim() || undefined })
              }
            />
            <div className="flex items-center gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[14px] text-[var(--label)] flex-1">
                Резидент Кипра
              </span>
              <span className="text-[12px] text-[var(--label-tertiary)]">
                {master.tax_resident ? "VAT 19%" : "не применять"}
              </span>
              <IOSSwitch
                checked={master.tax_resident ?? false}
                onChange={(next) => patchMaster({ tax_resident: next })}
                ariaLabel="Резидент Кипра"
              />
            </div>
          </div>
          <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Реквизиты общие для сотрудника. «Резидент Кипра» влияет на VAT в payroll.
          </div>
        </div>
      )}

      <SalaryRuleEditor
        open={editorOpen}
        rule={editingRule}
        brigade={editingBrigade}
        onSave={saveRule}
        onDelete={
          editingRule &&
          (master.salary_rules ?? []).some((r) => r.id === editingRule.id)
            ? () => deleteRule(editingRule.id)
            : undefined
        }
        onClose={() => {
          setEditorOpen(false);
          setEditingRule(null);
        }}
      />
    </MasterSectionShell>
  );
}

function RuleCardView({
  rule,
  brigade,
  orphan,
  estimate,
  onClick,
}: {
  rule: SalaryRule;
  brigade: Team | null;
  orphan: boolean;
  estimate: number;
  onClick: () => void;
}) {
  const configured = isRuleConfigured(rule);
  const period = rule.period ?? "monthly";
  const method = rule.method ?? "cash";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3 flex items-start gap-3 active:bg-[var(--fill-quaternary)] transition"
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: brigade
            ? `${brigade.color}22`
            : "var(--fill-tertiary)",
        }}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: brigade?.color ?? "var(--label-tertiary)" }}
        />
      </span>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[15px] font-semibold text-[var(--label)] truncate">
            {brigade?.name ?? "Без бригады"}
          </span>
          {orphan && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--system-red)] bg-[rgba(255,59,48,0.1)] px-1.5 py-0.5 rounded">
              бригада удалена
            </span>
          )}
          {!configured && !orphan && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--system-yellow-strong,#B78600)] bg-[rgba(255,149,0,0.1)] px-1.5 py-0.5 rounded">
              пусто
            </span>
          )}
        </div>
        <div className="text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
          {describeRule(rule)}
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
          {SALARY_PERIOD_LABELS[period].toLowerCase()} ·{" "}
          {PAYMENT_METHOD_LABELS[method].toLowerCase()}
          {estimate > 0 && (
            <span className="text-[var(--label-secondary)]">
              {" · ≈ "}
              <span className="tabular-nums font-semibold">
                {formatEUR(estimate)}/мес
              </span>
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={16}
        strokeWidth={2}
        className="text-[var(--label-quaternary)] shrink-0 mt-2"
      />
    </button>
  );
}

function BankTextRow({
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

function pluralSuffix(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "о";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "а";
  return "";
}
