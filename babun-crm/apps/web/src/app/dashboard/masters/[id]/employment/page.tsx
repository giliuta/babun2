"use client";

// Sprint 033 Phase I32 — Master Employment subroute.
// Owns the "как устроен" part of a master: role, brigade assignment,
// contract type, dates, and work schedule. iOS Settings grouped
// cards with instant commit on blur.

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  CERTIFICATION_LABELS,
  CONTRACT_LABELS,
  LEAVE_LABELS,
  ROLE_LABELS,
  WEEKDAY_LABELS,
  appendAudit,
  defaultPermissionsForRole,
  defaultWorkSchedule,
  generateId,
  getTeamLeadIds,
  type Certification,
  type CertificationKind,
  type ContractType,
  type LeaveKind,
  type Master,
  type MasterLeave,
  type MasterRole,
  type Team,
  type WorkSchedule,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

const ROLE_ORDER: MasterRole[] = ["admin", "dispatcher", "lead", "helper"];
const CONTRACT_ORDER: ContractType[] = [
  "full_time",
  "part_time",
  "contractor",
  "trial",
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterEmploymentPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { masters, upsertMaster } = useMasters();
  const { teams } = useTeams();
  const master = masters.find((m) => m.id === id);

  const [schedule, setSchedule] = useState<WorkSchedule>(
    master?.work_schedule ?? defaultWorkSchedule(),
  );
  const [skillInput, setSkillInput] = useState("");
  const [newCertOpen, setNewCertOpen] = useState(false);
  const [newLeaveOpen, setNewLeaveOpen] = useState(false);

  useEffect(() => {
    setSchedule(master?.work_schedule ?? defaultWorkSchedule());
  }, [master]);

  // Assigned brigades = union of legacy primary (team_id) and every
  // team whose lead_ids/helper_ids contains this master. Read-only on
  // this page — membership is edited on the brigade page itself.
  const assignedBrigades = useMemo<
    { team: Team; role: "lead" | "helper" | "primary" }[]
  >(() => {
    if (!master) return [];
    const seen = new Map<string, { team: Team; role: "lead" | "helper" | "primary" }>();
    for (const t of teams) {
      const leadIds = getTeamLeadIds(t);
      if (leadIds.includes(master.id)) {
        seen.set(t.id, { team: t, role: "lead" });
      } else if (t.helper_ids.includes(master.id)) {
        seen.set(t.id, { team: t, role: "helper" });
      }
    }
    if (master.team_id) {
      const t = teams.find((x) => x.id === master.team_id);
      if (t && !seen.has(t.id)) {
        seen.set(t.id, { team: t, role: "primary" });
      }
    }
    return Array.from(seen.values());
  }, [master, teams]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Трудоустройство" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const patch = (diff: Partial<Master>) => {
    upsertMaster({ ...master, ...diff });
  };

  const commitRole = (next: MasterRole) => {
    if (next === master.role) return;
    haptic("tap");
    const before = ROLE_LABELS[master.role];
    const after = ROLE_LABELS[next];
    const nextMaster = appendAudit(
      {
        ...master,
        role: next,
        permissions: defaultPermissionsForRole(next),
      },
      {
        action: "role_changed",
        summary: `Роль: «${before}» → «${after}»`,
      },
    );
    upsertMaster(nextMaster);
  };

  const commitContract = (next: ContractType) => {
    if (next === master.contract_type) return;
    haptic("tap");
    patch({ contract_type: next });
  };

  const commitHireDate = (v: string) => {
    if (v === (master.hire_date ?? "")) return;
    patch({ hire_date: v || undefined });
  };

  const commitSchedule = (next: WorkSchedule) => {
    setSchedule(next);
    patch({ work_schedule: next });
  };

  const toggleDay = (idx: number) => {
    const days = [...schedule.days] as WorkSchedule["days"];
    days[idx] = !days[idx];
    haptic("tap");
    commitSchedule({ ...schedule, days });
  };

  const commitScheduleTime = (field: "start_time" | "end_time", v: string) => {
    if (!v) return;
    commitSchedule({ ...schedule, [field]: v });
  };

  // ── Skills (tag chips) ───────────────────────────────────────────
  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    const current = master.skills ?? [];
    if (current.includes(v)) {
      setSkillInput("");
      return;
    }
    haptic("tap");
    patch({ skills: [...current, v] });
    setSkillInput("");
  };
  const removeSkill = (s: string) => {
    const current = master.skills ?? [];
    haptic("tap");
    patch({ skills: current.filter((x) => x !== s) });
  };

  // ── Certifications ───────────────────────────────────────────────
  const addCert = (cert: Certification) => {
    const current = master.certifications ?? [];
    upsertMaster(
      appendAudit(
        { ...master, certifications: [...current, cert] },
        {
          action: "certification_changed",
          summary: `Добавлен сертификат «${
            cert.label || CERTIFICATION_LABELS[cert.kind]
          }»`,
        },
      ),
    );
    setNewCertOpen(false);
  };
  const updateCert = (cert: Certification) => {
    const current = master.certifications ?? [];
    patch({
      certifications: current.map((c) => (c.id === cert.id ? cert : c)),
    });
  };
  const removeCert = (certId: string) => {
    const current = master.certifications ?? [];
    const removed = current.find((c) => c.id === certId);
    upsertMaster(
      appendAudit(
        { ...master, certifications: current.filter((c) => c.id !== certId) },
        {
          action: "certification_changed",
          summary: removed
            ? `Удалён сертификат «${
                removed.label || CERTIFICATION_LABELS[removed.kind]
              }»`
            : "Сертификат удалён",
        },
      ),
    );
  };

  // ── Leaves ───────────────────────────────────────────────────────
  const addLeave = (leave: MasterLeave) => {
    const current = master.leaves ?? [];
    upsertMaster(
      appendAudit(
        { ...master, leaves: [...current, leave] },
        {
          action: "leave_added",
          summary: `${LEAVE_LABELS[leave.kind]}: ${leave.start} → ${leave.end}${
            leave.paid ? " (оплачивается)" : " (без сохр. ЗП)"
          }`,
        },
      ),
    );
    setNewLeaveOpen(false);
  };
  const updateLeave = (leave: MasterLeave) => {
    const current = master.leaves ?? [];
    patch({
      leaves: current.map((l) => (l.id === leave.id ? leave : l)),
    });
  };
  const removeLeave = (leaveId: string) => {
    const current = master.leaves ?? [];
    upsertMaster(
      appendAudit(
        { ...master, leaves: current.filter((l) => l.id !== leaveId) },
        {
          action: "leave_removed",
          summary: "Отпуск удалён",
        },
      ),
    );
  };

  void teams; // read via assignedBrigades

  return (
    <MasterSectionShell masterId={id} title="Трудоустройство" hideSave>
      {/* ── Роль ─────────────────────────────────────────────────── */}
      <Section title="Роль" footer="Определяет, что сотрудник может в Babun по умолчанию.">
        <div className="p-2 grid grid-cols-2 gap-2">
          {ROLE_ORDER.map((r) => {
            const picked = master.role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => commitRole(r)}
                className={`h-10 rounded-[10px] text-[14px] font-medium press-scale transition-colors ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Бригады (read-only) ─────────────────────────────────── */}
      <Section
        title="Бригады"
        footer="Сотрудник привязывается к бригаде на странице самой бригады. Тут — только список, куда его уже добавили."
      >
        {assignedBrigades.length === 0 ? (
          <div className="px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
            Пока не в одной бригаде.
            <br />
            Откройте нужную бригаду и добавьте его в составе.
          </div>
        ) : (
          assignedBrigades.map(({ team: t, role: assignRole }, i) => {
            const last = i === assignedBrigades.length - 1;
            const roleLabel =
              assignRole === "lead"
                ? "Бригадир"
                : assignRole === "helper"
                  ? "Помощник"
                  : "Основная";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  haptic("tap");
                  router.push(`/dashboard/teams/${t.id}`);
                }}
                className={`w-full flex items-center gap-3 px-4 min-h-[48px] ${
                  last ? "" : "border-b border-[var(--separator)]"
                } active:bg-[var(--fill-quaternary)] transition-colors`}
              >
                <span
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-[15px] text-[var(--label)] truncate">
                    {t.name}
                  </span>
                  <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
                    {roleLabel}
                    {t.default_city ? ` · ${t.default_city}` : ""}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="text-[var(--label-quaternary)] shrink-0"
                />
              </button>
            );
          })
        )}
      </Section>

      {/* ── Контракт ─────────────────────────────────────────────── */}
      <Section title="Тип занятости">
        <div className="p-2 grid grid-cols-2 gap-2">
          {CONTRACT_ORDER.map((c) => {
            const picked = master.contract_type === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => commitContract(c)}
                className={`h-10 px-2 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                }`}
              >
                {CONTRACT_LABELS[c]}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Дата найма ───────────────────────────────────────────── */}
      <Section title="Дата найма">
        <label className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Дата
          </span>
          <input
            type="date"
            value={master.hire_date ?? ""}
            onChange={(e) => commitHireDate(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
      </Section>

      {/* ── График ───────────────────────────────────────────────── */}
      <Section
        title="Рабочий график"
        footer="Используется для подсказок в календаре и расчёта почасовой ЗП."
      >
        <div className="px-4 py-3 border-b border-[var(--separator)]">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const on = schedule.days[i];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-10 rounded-[10px] text-[13px] font-medium press-scale transition-colors ${
                    on
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-3 min-h-[44px] px-4 border-b border-[var(--separator)]">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Начало дня
          </span>
          <input
            type="time"
            value={schedule.start_time}
            onChange={(e) => commitScheduleTime("start_time", e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
            Конец дня
          </span>
          <input
            type="time"
            value={schedule.end_time}
            onChange={(e) => commitScheduleTime("end_time", e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
          />
        </label>
      </Section>

      {/* ── НАВЫКИ ───────────────────────────────────────────────── */}
      <Section
        title="Навыки"
        footer="Теги того, что умеет. Диспетчер сможет фильтровать по навыку при назначении."
      >
        {(master.skills ?? []).length === 0 ? (
          <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
            Пока не указаны.
          </div>
        ) : (
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {(master.skills ?? []).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-[var(--fill-tertiary)] text-[13px] text-[var(--label)]"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSkill(s)}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-primary)]"
                  aria-label={`Убрать ${s}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--separator)]">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Напр. «Установка», «F-gas», «Чиллеры»"
            className="flex-1 h-9 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={60}
          />
          <button
            type="button"
            onClick={addSkill}
            disabled={!skillInput.trim()}
            className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center press-scale disabled:opacity-40"
            aria-label="Добавить"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      </Section>

      {/* ── СЕРТИФИКАТЫ ──────────────────────────────────────────── */}
      <Section
        title="Сертификаты"
        footer="За месяц до истечения срок подсвечивается оранжевым, после — красным."
      >
        {(master.certifications ?? []).length === 0 && !newCertOpen && (
          <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
            Пока ничего не добавлено.
          </div>
        )}
        {(master.certifications ?? []).map((c, i) => (
          <CertRow
            key={c.id}
            cert={c}
            onChange={updateCert}
            onRemove={() => removeCert(c.id)}
            last={
              i === (master.certifications ?? []).length - 1 && !newCertOpen
            }
          />
        ))}
        {newCertOpen && (
          <CertEditor
            onSubmit={addCert}
            onCancel={() => setNewCertOpen(false)}
          />
        )}
        {!newCertOpen && (
          <button
            type="button"
            onClick={() => setNewCertOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Plus size={15} strokeWidth={2.5} />
            </span>
            <span className="text-[14px] font-medium text-[var(--accent)]">
              Добавить сертификат
            </span>
          </button>
        )}
      </Section>

      {/* ── ОТПУСК / БОЛЬНИЧНЫЙ ─────────────────────────────────── */}
      <Section
        title="Отпуск и больничный"
        footer={
          "Флаг «оплачивается» решает, начисляется ли ЗП за период. " +
          "Замена — мастер, который покрывает визиты пока этот отсутствует."
        }
      >
        {(master.leaves ?? []).length === 0 && !newLeaveOpen && (
          <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
            Пока не отмечено.
          </div>
        )}
        {(master.leaves ?? [])
          .slice()
          .sort((a, b) => (a.start < b.start ? 1 : -1))
          .map((l, i, arr) => (
            <LeaveRow
              key={l.id}
              leave={l}
              masters={masters}
              onChange={updateLeave}
              onRemove={() => removeLeave(l.id)}
              last={i === arr.length - 1 && !newLeaveOpen}
              selfId={master.id}
            />
          ))}
        {newLeaveOpen && (
          <LeaveEditor
            masters={masters}
            selfId={master.id}
            onSubmit={addLeave}
            onCancel={() => setNewLeaveOpen(false)}
          />
        )}
        {!newLeaveOpen && (
          <button
            type="button"
            onClick={() => setNewLeaveOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Plus size={15} strokeWidth={2.5} />
            </span>
            <span className="text-[14px] font-medium text-[var(--accent)]">
              Отметить период
            </span>
          </button>
        )}
      </Section>
    </MasterSectionShell>
  );
}

// ─── Certification row + editor ────────────────────────────────────

function CertRow({
  cert,
  onChange,
  onRemove,
  last,
}: {
  cert: Certification;
  onChange: (c: Certification) => void;
  onRemove: () => void;
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expires = cert.expires_at ? new Date(cert.expires_at) : null;
  const now = new Date();
  const isExpired = expires && expires < now;
  const isSoon =
    expires &&
    !isExpired &&
    expires.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 30;
  const label = cert.label || CERTIFICATION_LABELS[cert.kind];
  return (
    <div className={`${last ? "" : "border-b border-[var(--separator)]"}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-medium text-[var(--label)] truncate">
            {label}
          </span>
          <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
            {cert.number ? `№ ${cert.number}` : "номер не указан"}
            {cert.expires_at ? ` · до ${cert.expires_at}` : ""}
          </span>
        </span>
        {(isExpired || isSoon) && (
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              isExpired
                ? "bg-[rgba(255,59,48,0.1)] text-[var(--system-red)]"
                : "bg-[rgba(255,149,0,0.1)] text-[var(--system-orange)]"
            }`}
          >
            {isExpired ? "истёк" : "скоро"}
          </span>
        )}
      </button>
      {open && (
        <CertEditor
          initial={cert}
          onSubmit={(c) => {
            onChange(c);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          onRemove={() => {
            onRemove();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CertEditor({
  initial,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initial?: Certification;
  onSubmit: (c: Certification) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const KIND_ORDER: CertificationKind[] = [
    "fgas",
    "electrical",
    "driving",
    "medical",
    "work_permit",
    "language",
    "other",
  ];
  const [kind, setKind] = useState<CertificationKind>(initial?.kind ?? "fgas");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [issuedAt, setIssuedAt] = useState(initial?.issued_at ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const save = () => {
    onSubmit({
      id: initial?.id ?? generateId("cert"),
      kind,
      label: label.trim() || undefined,
      number: number.trim() || undefined,
      issued_at: issuedAt || undefined,
      expires_at: expiresAt || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="px-4 py-3 bg-[var(--fill-tertiary)] border-t border-[var(--separator)] space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {KIND_ORDER.map((k) => {
          const picked = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`h-9 rounded-[10px] text-[12px] font-medium press-scale transition-colors ${
                picked
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)]"
              }`}
            >
              {CERTIFICATION_LABELS[k]}
            </button>
          );
        })}
      </div>
      {kind === "other" && (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Название сертификата"
          className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          maxLength={80}
        />
      )}
      <input
        type="text"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Номер"
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
        maxLength={80}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] bg-[var(--surface-card)]">
          <span className="text-[12px] text-[var(--label-secondary)] shrink-0">
            Выдан
          </span>
          <input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--label)] focus:outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] bg-[var(--surface-card)]">
          <span className="text-[12px] text-[var(--label-secondary)] shrink-0">
            До
          </span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--label)] focus:outline-none tabular-nums"
          />
        </label>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка (опционально)"
        rows={2}
        maxLength={200}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          className="flex-1 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-full bg-[var(--fill-primary)] text-[var(--label)] text-[14px] press-scale"
        >
          Отмена
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-10 w-10 rounded-full bg-[var(--fill-primary)] text-[var(--system-red)] flex items-center justify-center press-scale"
            aria-label="Удалить"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Leave row + editor ────────────────────────────────────────────

function LeaveRow({
  leave,
  masters,
  onChange,
  onRemove,
  last,
  selfId,
}: {
  leave: MasterLeave;
  masters: Master[];
  onChange: (l: MasterLeave) => void;
  onRemove: () => void;
  last?: boolean;
  selfId: string;
}) {
  const [open, setOpen] = useState(false);
  const sub = leave.substitute_master_id
    ? masters.find((m) => m.id === leave.substitute_master_id)
    : null;
  return (
    <div className={`${last ? "" : "border-b border-[var(--separator)]"}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-medium text-[var(--label)] truncate">
            {LEAVE_LABELS[leave.kind]} · {leave.start} — {leave.end}
          </span>
          <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
            {leave.paid ? "оплачивается" : "без сохр. ЗП"}
            {sub ? ` · замена: ${sub.full_name}` : ""}
          </span>
        </span>
      </button>
      {open && (
        <LeaveEditor
          initial={leave}
          masters={masters}
          selfId={selfId}
          onSubmit={(l) => {
            onChange(l);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          onRemove={() => {
            onRemove();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LeaveEditor({
  initial,
  masters,
  selfId,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initial?: MasterLeave;
  masters: Master[];
  selfId: string;
  onSubmit: (l: MasterLeave) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const KIND_ORDER: LeaveKind[] = ["vacation", "sick", "personal", "unpaid"];
  const [kind, setKind] = useState<LeaveKind>(initial?.kind ?? "vacation");
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [paid, setPaid] = useState(initial?.paid ?? kind === "vacation");
  const [substituteId, setSubstituteId] = useState<string | null>(
    initial?.substitute_master_id ?? null,
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const availableSubs = masters.filter(
    (m) => m.is_active && m.id !== selfId,
  );

  const save = () => {
    if (!start || !end) return;
    onSubmit({
      id: initial?.id ?? generateId("leave"),
      kind,
      start,
      end,
      paid,
      substitute_master_id: substituteId,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="px-4 py-3 bg-[var(--fill-tertiary)] border-t border-[var(--separator)] space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {KIND_ORDER.map((k) => {
          const picked = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                // По умолчанию отпуск / личные — оплачиваются;
                // больничный / без содержания — нет. Админ может
                // переопределить тумблером ниже.
                setPaid(k === "vacation" || k === "personal");
              }}
              className={`h-9 rounded-[10px] text-[11px] font-medium press-scale transition-colors ${
                picked
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)]"
              }`}
            >
              {LEAVE_LABELS[k]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] bg-[var(--surface-card)]">
          <span className="text-[12px] text-[var(--label-secondary)] shrink-0">
            С
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--label)] focus:outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] bg-[var(--surface-card)]">
          <span className="text-[12px] text-[var(--label-secondary)] shrink-0">
            По
          </span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--label)] focus:outline-none tabular-nums"
          />
        </label>
      </div>
      <div className="flex items-center gap-3 h-11 px-3 rounded-[10px] bg-[var(--surface-card)]">
        <span className="text-[13px] text-[var(--label)] flex-1">
          Оплачивается
        </span>
        <span className="text-[12px] text-[var(--label-tertiary)]">
          {paid ? "ЗП начисляется" : "ЗП не начисляется"}
        </span>
        <IOSSwitch
          checked={paid}
          onChange={setPaid}
          ariaLabel="Оплачивается"
        />
      </div>
      <select
        value={substituteId ?? ""}
        onChange={(e) => setSubstituteId(e.target.value || null)}
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[13px] text-[var(--label)] focus:outline-none"
      >
        <option value="">Без замены</option>
        {availableSubs.map((m) => (
          <option key={m.id} value={m.id}>
            Замена: {m.full_name}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка (опционально)"
        rows={2}
        maxLength={200}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={!start || !end}
          className="flex-1 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale disabled:opacity-40"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-full bg-[var(--fill-primary)] text-[var(--label)] text-[14px] press-scale"
        >
          Отмена
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-10 w-10 rounded-full bg-[var(--fill-primary)] text-[var(--system-red)] flex items-center justify-center press-scale"
            aria-label="Удалить"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
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
