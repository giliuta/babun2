"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  User as UserIcon,
  X,
} from "@babun/shared/icons";
import {
  appendAudit,
  defaultPermissionsForRole,
  generateId,
  generatePassword,
  getInitials,
  type Master,
} from "@babun/shared/local/masters";
import { isAvatarSet } from "@babun/shared/local/selectors/avatars";
import { haptic } from "@/lib/haptics";
import AvatarPickerSheet from "./AvatarPickerSheet";

interface NewMasterPopupProps {
  open: boolean;
  onClose: () => void;
  onCreated: (master: Master) => void;
}

// Compact create-employee dialog. Captures just enough to persist
// a working card with login credentials: photo, name, phone, login,
// password. The rest (birthday, contacts, territory, docs…) lives
// on /dashboard/masters/[id]/info.
export default function NewMasterPopup({
  open,
  onClose,
  onCreated,
}: NewMasterPopupProps) {
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Reset fields when the dialog opens. Password is deliberately
  // empty — the user either types their own or taps the ↻ button to
  // generate one. Pre-filling felt pushy per user feedback.
  useEffect(() => {
    if (!open) return;
    setAvatarUrl(null);
    setFullName("");
    setPhone("");
    setLoginEmail("");
    setPassword("");
    setShowPassword(false);
    setNameError(false);
    setLoginError(false);
    setPasswordError(false);
    // Don't auto-focus — opens iOS keyboard before the user sees
    // the layout, which hides the avatar selection.
  }, [open]);

  const canSubmit = useMemo(
    () =>
      fullName.trim().length > 0 &&
      loginEmail.trim().length > 0 &&
      password.length > 0,
    [fullName, loginEmail, password],
  );

  if (!open) return null;

  const copyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      haptic("tap");
    } catch {
      // Clipboard blocked — user can copy manually.
    }
  };

  const regenerate = () => {
    haptic("tap");
    setPassword(generatePassword());
    setShowPassword(true);
  };

  const submit = () => {
    const nameBad = fullName.trim().length === 0;
    const loginBad = loginEmail.trim().length === 0;
    const passwordBad = password.length === 0;
    if (nameBad || loginBad || passwordBad) {
      setNameError(nameBad);
      setLoginError(loginBad);
      setPasswordError(passwordBad);
      haptic("warning");
      if (nameBad) firstInputRef.current?.focus();
      return;
    }
    haptic("tap");
    const trimmedLogin = loginEmail.trim();
    const now = new Date().toISOString();
    const base: Master = {
      id: generateId("master"),
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: avatarUrl,
      team_id: null,
      role: "helper",
      is_active: true,
      permissions: defaultPermissionsForRole("helper"),
      created_at: now,
      email: trimmedLogin,
      login_email: trimmedLogin,
      credentials_set: true,
      invite_sent_at: now,
      account_status: "invited" as const,
    };
    const audited = appendAudit(base, {
      action: "credentials_issued",
      summary: `Выдан доступ · ${trimmedLogin}`,
    });
    onCreated(audited);
  };

  const avatarLabel = getInitials(fullName || "?");

  return (
    <>
      <div
        className="fixed inset-0 z-[88] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[400px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col max-h-[92vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
            <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
              Новый мастер
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

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Avatar tile */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-label="Сменить фото"
                className="w-24 h-24 rounded-full overflow-hidden bg-[var(--fill-tertiary)] flex items-center justify-center active:scale-[0.98] transition relative"
              >
                {isAvatarSet(avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl!} alt="" className="w-full h-full object-cover" />
                ) : fullName.trim() ? (
                  <span className="text-[28px] font-semibold text-[var(--label-secondary)]">
                    {avatarLabel}
                  </span>
                ) : (
                  <UserIcon
                    size={36}
                    strokeWidth={1.8}
                    className="text-[var(--label-tertiary)]"
                  />
                )}
              </button>
              <div className="text-[12px] text-[var(--label-tertiary)]">
                Нажмите, чтобы выбрать фото
              </div>
            </div>

            {/* Name + phone */}
            <div className="bg-[var(--fill-tertiary)] rounded-[12px] overflow-hidden">
              <Row
                label="ФИО"
                required
                invalid={nameError && fullName.trim().length === 0}
              >
                <input
                  ref={firstInputRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  placeholder="Фамилия Имя Отчество"
                  maxLength={80}
                  className="flex-1 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none text-right"
                />
              </Row>
              <Row label="Телефон" last>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+357 …"
                  maxLength={32}
                  className="flex-1 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none text-right"
                />
              </Row>
            </div>

            {/* Credentials */}
            <div>
              <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Учётная запись
              </div>
              <div className="bg-[var(--fill-tertiary)] rounded-[12px] overflow-hidden">
                <Row
                  label="Логин"
                  required
                  invalid={loginError && loginEmail.trim().length === 0}
                >
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginError) setLoginError(false);
                    }}
                    placeholder="login@example.com"
                    maxLength={120}
                    className="flex-1 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none text-right"
                  />
                </Row>
                <Row
                  label="Пароль"
                  required
                  invalid={passwordError && password.length === 0}
                  last
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(false);
                    }}
                    placeholder="—"
                    maxLength={64}
                    className="flex-1 bg-transparent text-[15px] font-mono text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none text-right tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Скрыть" : "Показать"}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-secondary)]"
                  >
                    {showPassword ? (
                      <EyeOff size={14} strokeWidth={2} />
                    ) : (
                      <Eye size={14} strokeWidth={2} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={regenerate}
                    aria-label="Сгенерировать новый"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-secondary)]"
                  >
                    <RefreshCw size={14} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    aria-label="Скопировать"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-secondary)]"
                  >
                    <Copy size={14} strokeWidth={2} />
                  </button>
                </Row>
              </div>
              <div className="px-1 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
                Без логина и пароля учётка не создастся. Пароль виден один
                раз — скопируйте и передайте мастеру.
              </div>
            </div>
          </div>

          <div
            className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
            }}
          >
            <button
              type="button"
              onClick={submit}
              className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
                canSubmit
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
                  : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
              }`}
            >
              Создать
            </button>
          </div>
        </div>
      </div>

      <AvatarPickerSheet
        open={pickerOpen}
        value={avatarUrl}
        onSelect={setAvatarUrl}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

function Row({
  label,
  required,
  invalid,
  last,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-center gap-2 min-h-[44px] px-3.5 ${
        last ? "" : "border-b border-[var(--separator)]"
      } ${invalid ? "bg-[rgba(255,59,48,0.08)]" : ""}`}
    >
      <span
        className={`text-[14px] shrink-0 w-[72px] ${
          invalid ? "text-[var(--system-red)]" : "text-[var(--label-secondary)]"
        }`}
      >
        {label}
        {required && <span className="text-[var(--system-red)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
