"use client";

// Sprint 033 Phase I31 — Master Info subroute. Mirrors brigade info:
// iOS-Settings style with instant commit on blur for the existing
// record, or a "Создать" pill for the new flow (`id === "new"`).

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import { useMasters } from "@/app/dashboard/layout";
import {
  ROLE_LABELS,
  defaultPermissionsForRole,
  generateId,
  getInitials,
  type Master,
  type MasterRole,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

const ROLE_ORDER: MasterRole[] = ["admin", "dispatcher", "lead", "helper"];

const BLANK_MASTER: Master = {
  id: "",
  full_name: "",
  phone: "",
  team_id: null,
  role: "helper",
  is_active: true,
  permissions: defaultPermissionsForRole("helper"),
  created_at: "",
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterInfoPage({ params }: RouteParams) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const { masters, upsertMaster } = useMasters();

  const existing = masters.find((m) => m.id === id);
  const initial: Master = isNew
    ? {
        ...BLANK_MASTER,
        id: generateId("master"),
        created_at: new Date().toISOString(),
      }
    : existing ?? BLANK_MASTER;

  const [fullName, setFullName] = useState(initial.full_name);
  const [role, setRole] = useState<MasterRole>(initial.role);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");

  useEffect(() => {
    if (!isNew && existing) {
      setFullName(existing.full_name);
      setRole(existing.role);
      setPhone(existing.phone);
      setEmail(existing.email ?? "");
      setBirthday(existing.birthday ?? "");
    }
  }, [existing, isNew]);

  if (!isNew && !existing) {
    return (
      <MasterSectionShell masterId={id} title="Информация" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  // ── instant commit helpers (existing master only) ────────────────
  const commit = (patch: Partial<Master>) => {
    if (!existing) return;
    upsertMaster({ ...existing, ...patch });
  };
  const commitName = (next: string) => {
    const trimmed = next.trim();
    if (!existing || !trimmed || trimmed === existing.full_name) return;
    commit({ full_name: trimmed });
  };
  const commitPhone = (next: string) => {
    const trimmed = next.trim();
    if (!existing || trimmed === existing.phone) return;
    commit({ phone: trimmed });
  };
  const commitEmail = (next: string) => {
    const trimmed = next.trim();
    if (!existing || trimmed === (existing.email ?? "")) return;
    commit({ email: trimmed || undefined });
  };
  const commitBirthday = (next: string) => {
    if (!existing || next === (existing.birthday ?? "")) return;
    commit({ birthday: next || undefined });
  };
  const commitRole = (next: MasterRole) => {
    if (!existing || next === existing.role) return;
    haptic("tap");
    // Role change rebuilds the permissions matrix defaults so the
    // downstream screen matches the new role. Existing overrides are
    // dropped on purpose — switching роль should feel like "new hat".
    commit({ role: next, permissions: defaultPermissionsForRole(next) });
  };

  // ── new-master create flow ──────────────────────────────────────
  const handleCreate = (): boolean => {
    if (!fullName.trim()) {
      haptic("warning");
      return false;
    }
    haptic("tap");
    upsertMaster({
      ...initial,
      full_name: fullName.trim(),
      role,
      phone: phone.trim(),
      email: email.trim() || undefined,
      birthday: birthday || undefined,
      permissions: defaultPermissionsForRole(role),
    });
    // Send the user back to the detail hub for the record we just
    // created (not the list), so they can immediately fill in team,
    // salary, etc.
    router.push(`/dashboard/masters/${initial.id}`);
    return false; // we navigated manually
  };

  const sharedShellProps = isNew
    ? {
        saveLabel: "Создать",
        canSave: fullName.trim().length > 0,
        onSave: handleCreate,
      }
    : { hideSave: true };

  const avatarInitials = getInitials(fullName || "?");

  return (
    <MasterSectionShell
      masterId={id}
      title={isNew ? "Новый сотрудник" : "Информация"}
      {...sharedShellProps}
    >
      {/* Avatar preview — initials over a neutral disk. Team colour
          would be misleading here since the brigade is set elsewhere. */}
      <div className="flex items-center justify-center pt-1 pb-2">
        <div className="w-16 h-16 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center text-[22px] font-semibold">
          {avatarInitials}
        </div>
      </div>

      {/* ── Имя ─────────────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Имя
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={(e) => commitName(e.target.value)}
            placeholder="Имя Фамилия"
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={60}
          />
        </div>
      </div>

      {/* ── Роль ────────────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Роль
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-2 grid grid-cols-2 gap-2">
          {ROLE_ORDER.map((r) => {
            const picked = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  commitRole(r);
                }}
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
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
          При смене роли доступы сбрасываются на стандартные для выбранной роли.
        </div>
      </div>

      {/* ── Телефон ─────────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Телефон
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={(e) => commitPhone(e.target.value)}
            placeholder="+357 …"
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={32}
          />
        </div>
      </div>

      {/* ── Email ───────────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Email
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => commitEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={120}
          />
        </div>
      </div>

      {/* ── День рождения ───────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          День рождения
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            onBlur={(e) => commitBirthday(e.target.value)}
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </div>
      </div>
    </MasterSectionShell>
  );
}
