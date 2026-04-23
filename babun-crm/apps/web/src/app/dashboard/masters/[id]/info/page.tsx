"use client";

// Sprint 033 Phase I32 — Master Info mega-page.
//
// Per user decision on v278: «всю учётку + информацию + контакты
// объединяем в одну страницу». One long scroll, grouped into iOS
// Settings sections:
//   · Основное:      имя, день рождения
//   · Контакты:      телефон, WhatsApp, Telegram, email, адрес,
//                    экстренный контакт
//   · Учётка Babun:  login email, статус, последний вход, кнопка
//                    выдать/сбросить пароль
//
// Role + brigade + schedule live on /employment now.
//
// Instant commit on blur for existing records; new-master flow shows
// a top-right "Создать" pill that persists the draft and jumps to
// the detail hub so the user can fill the remaining sections.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw, UserMinus } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useMasters } from "@/app/dashboard/layout";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
  defaultPermissionsForRole,
  generateId,
  generatePassword,
  getInitials,
  type AccountStatus,
  type Master,
} from "@/lib/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

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

  // Identity
  const [fullName, setFullName] = useState(initial.full_name);
  const [title, setTitle] = useState(initial.title ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");

  // Contacts
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [emergencyContact, setEmergencyContact] = useState(
    initial.emergency_contact ?? "",
  );

  // Babun account
  const [loginEmail, setLoginEmail] = useState(
    initial.login_email ?? initial.email ?? "",
  );
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isNew && existing) {
      setFullName(existing.full_name);
      setTitle(existing.title ?? "");
      setBirthday(existing.birthday ?? "");
      setPhone(existing.phone);
      setWhatsapp(existing.whatsapp ?? "");
      setTelegram(existing.telegram ?? "");
      setEmail(existing.email ?? "");
      setAddress(existing.address ?? "");
      setEmergencyContact(existing.emergency_contact ?? "");
      setLoginEmail(existing.login_email ?? existing.email ?? "");
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

  // ── Instant commit helpers (existing master only) ────────────────
  const patch = (diff: Partial<Master>) => {
    if (!existing) return;
    upsertMaster({ ...existing, ...diff });
  };

  const commitStr = (field: keyof Master, next: string, optional = false) => {
    if (!existing) return;
    const trimmed = next.trim();
    const current = (existing[field] as string | undefined) ?? "";
    if (trimmed === current) return;
    patch({ [field]: optional ? trimmed || undefined : trimmed } as Partial<Master>);
  };

  // ── Babun account actions ────────────────────────────────────────
  const issueCredentials = () => {
    if (!existing) return;
    if (!loginEmail.trim()) {
      haptic("warning");
      return;
    }
    const pwd = generatePassword();
    setGeneratedPassword(pwd);
    setShowPassword(true);
    haptic("tap");
    const nextStatus: AccountStatus = "invited";
    patch({
      login_email: loginEmail.trim(),
      credentials_set: true,
      invite_sent_at: new Date().toISOString(),
      account_status: nextStatus,
    });
  };

  const revokeCredentials = () => {
    if (!existing) return;
    haptic("warning");
    setGeneratedPassword(null);
    patch({
      credentials_set: false,
      account_status: "terminated",
      terminated_at: new Date().toISOString().slice(0, 10),
    });
  };

  const copyPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      haptic("tap");
    } catch {
      // Clipboard may be blocked; user can select text manually.
    }
  };

  // ── New-master create flow ───────────────────────────────────────
  const handleCreate = (): boolean => {
    if (!fullName.trim()) {
      haptic("warning");
      return false;
    }
    haptic("tap");
    upsertMaster({
      ...initial,
      full_name: fullName.trim(),
      title: title.trim() || undefined,
      phone: phone.trim(),
      birthday: birthday || undefined,
      whatsapp: whatsapp.trim() || undefined,
      telegram: telegram.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      login_email: loginEmail.trim() || undefined,
    });
    router.push(`/dashboard/masters/${initial.id}`);
    return false;
  };

  const sharedShellProps = isNew
    ? {
        saveLabel: "Создать",
        canSave: fullName.trim().length > 0,
        onSave: handleCreate,
      }
    : { hideSave: true };

  const avatarInitials = getInitials(fullName || "?");
  const accountStatus: AccountStatus | undefined = existing?.account_status;
  const lastLogin = existing?.last_login_at
    ? new Date(existing.last_login_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const inviteSent = existing?.invite_sent_at
    ? new Date(existing.invite_sent_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <MasterSectionShell
      masterId={id}
      title={isNew ? "Новый сотрудник" : "Информация"}
      {...sharedShellProps}
    >
      {/* Avatar preview */}
      <div className="flex flex-col items-center pt-1 pb-2 gap-1.5">
        <div className="w-20 h-20 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center text-[26px] font-semibold">
          {avatarInitials}
        </div>
        <div className="text-[13px] text-[var(--label-tertiary)]">
          {isNew ? "Новая карточка" : "Фото появится в v2"}
        </div>
      </div>

      {/* ── ОСНОВНОЕ ──────────────────────────────────────────────── */}
      <Section
        title="Основное"
        footer="Должность — свободное описание роли внутри компании. На права в Babun не влияет (за права отвечает раздел «Доступы»)."
      >
        <TextRow
          label="Имя"
          value={fullName}
          setValue={setFullName}
          onCommit={(v) => commitStr("full_name", v)}
          placeholder="Имя Фамилия"
          maxLength={60}
          required
        />
        <TextRow
          label="Должность"
          value={title}
          setValue={setTitle}
          onCommit={(v) => commitStr("title", v, true)}
          placeholder="Напр. «Старший техник»"
          maxLength={80}
        />
        <DateRow
          label="День рождения"
          value={birthday}
          setValue={setBirthday}
          onCommit={(v) => {
            if (!existing) return;
            if (v === (existing.birthday ?? "")) return;
            patch({ birthday: v || undefined });
          }}
          last
        />
      </Section>

      {/* ── КОНТАКТЫ ──────────────────────────────────────────────── */}
      <Section title="Контакты" footer="Как с сотрудником связаться вне Babun">
        <TextRow
          label="Телефон"
          value={phone}
          setValue={setPhone}
          onCommit={(v) => commitStr("phone", v)}
          placeholder="+357 …"
          type="tel"
          maxLength={32}
        />
        <TextRow
          label="WhatsApp"
          value={whatsapp}
          setValue={setWhatsapp}
          onCommit={(v) => commitStr("whatsapp", v, true)}
          placeholder="если отличается"
          type="tel"
          maxLength={32}
        />
        <TextRow
          label="Telegram"
          value={telegram}
          setValue={setTelegram}
          onCommit={(v) => commitStr("telegram", v, true)}
          placeholder="@username"
          maxLength={32}
        />
        <TextRow
          label="Email"
          value={email}
          setValue={setEmail}
          onCommit={(v) => commitStr("email", v, true)}
          placeholder="personal@example.com"
          type="email"
          maxLength={120}
        />
        <TextRow
          label="Адрес"
          value={address}
          setValue={setAddress}
          onCommit={(v) => commitStr("address", v, true)}
          placeholder="Пафос, улица…"
          maxLength={120}
        />
        <TextRow
          label="Экстр. контакт"
          value={emergencyContact}
          setValue={setEmergencyContact}
          onCommit={(v) => commitStr("emergency_contact", v, true)}
          placeholder="Имя · телефон"
          maxLength={120}
          last
        />
      </Section>

      {/* ── УЧЁТКА В BABUN ────────────────────────────────────────── */}
      {!isNew && (
        <Section
          title="Учётная запись в Babun"
          footer={
            existing?.credentials_set
              ? "Доступ выдан. Сбросьте пароль — старый перестанет работать."
              : "Выдайте сотруднику логин и пароль. Пароль показывается один раз — продиктуйте его по телефону или перешлите в Telegram."
          }
        >
          <TextRow
            label="Email входа"
            value={loginEmail}
            setValue={setLoginEmail}
            onCommit={(v) => commitStr("login_email", v, true)}
            placeholder="login@example.com"
            type="email"
            maxLength={120}
          />
          {accountStatus && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Статус</span>
              <span
                className={`text-[12px] font-semibold px-2 py-0.5 rounded-full border ${ACCOUNT_STATUS_TONE[accountStatus]}`}
              >
                {ACCOUNT_STATUS_LABELS[accountStatus]}
              </span>
            </div>
          )}
          {lastLogin && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Последний вход</span>
              <span className="text-[14px] text-[var(--label-secondary)] tabular-nums">
                {lastLogin}
              </span>
            </div>
          )}
          {inviteSent && !lastLogin && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Приглашён</span>
              <span className="text-[14px] text-[var(--label-secondary)] tabular-nums">
                {inviteSent}
              </span>
            </div>
          )}

          {generatedPassword && (
            <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--accent-tint)]">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-1.5">
                Пароль — покажется один раз
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex-1 text-[15px] font-mono tracking-wide text-[var(--label)] tabular-nums truncate ${
                    showPassword ? "" : "blur-sm select-none"
                  }`}
                >
                  {generatedPassword}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Скрыть" : "Показать"}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--label-secondary)] press-scale"
                >
                  {showPassword ? (
                    <EyeOff size={14} strokeWidth={2} />
                  ) : (
                    <Eye size={14} strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  aria-label="Скопировать"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--label-secondary)] press-scale"
                >
                  <Copy size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-t border-[var(--separator)] flex flex-col gap-2">
            <button
              type="button"
              onClick={issueCredentials}
              disabled={!loginEmail.trim()}
              className="w-full h-11 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {existing?.credentials_set ? (
                <>
                  <RefreshCw size={15} strokeWidth={2.5} />
                  Сбросить пароль
                </>
              ) : (
                <>
                  <KeyRound size={15} strokeWidth={2.5} />
                  Выдать доступ
                </>
              )}
            </button>
            {existing?.credentials_set && (
              <button
                type="button"
                onClick={revokeCredentials}
                className="w-full h-11 rounded-full bg-[var(--fill-tertiary)] text-[var(--system-red)] text-[14px] font-medium press-scale flex items-center justify-center gap-2"
              >
                <UserMinus size={15} strokeWidth={2.5} />
                Забрать доступ
              </button>
            )}
          </div>
        </Section>
      )}
    </MasterSectionShell>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────

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

// ─── Row primitives (iOS Settings look) ────────────────────────────

function TextRow({
  label,
  value,
  setValue,
  onCommit,
  placeholder,
  maxLength,
  type = "text",
  required,
  last,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  onCommit: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "tel" | "email";
  required?: boolean;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
        {label}
        {required && <span className="text-[var(--system-red)]"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="flex-1 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] text-right focus:outline-none"
      />
    </label>
  );
}

function DateRow({
  label,
  value,
  setValue,
  onCommit,
  last,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  onCommit: (v: string) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
      />
    </label>
  );
}
