"use client";

// STORY-041 G4 + STORY-076 — Password change + 2FA management.
//
// Password block: confirmation field guards typos that would brick
// the account until forgot-password runs. Min length matches Supabase
// default (8).
//
// 2FA block: TOTP via Supabase MFA (works out of the box with
// Authenticator apps). Email + SMS rendered as "Скоро" cards because
// they need additional plumbing (custom email-OTP table for email,
// Supabase Phone provider config for SMS).

import { useEffect, useState } from "react";
import { Lock, Check, Shield, ShieldCheck, Mail, Phone } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TotpEnrollDialog from "./TotpEnrollDialog";
// P2 #43 (CRM Core brief) — collapses the {saving, error, savedAt}
// trio into one tagged union so the button label never disagrees
// with the indicator.
import { useSaveStatus } from "@/hooks/useSaveStatus";

export default function SecuritySection() {
  return (
    <div className="space-y-5">
      <PasswordBlock />
      <TwoFactorBlock />
    </div>
  );
}

// ─── Password ──────────────────────────────────────────────────

function PasswordBlock() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const save = useSaveStatus();
  const saving = save.status === "saving";
  const error = save.error;
  const savedAt = save.status === "saved";

  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const canSubmit = pwd.length >= 8 && confirm === pwd && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await save.run(async () => {
      const supabase = getSupabaseBrowser();
      const { error: err } = await supabase.auth.updateUser({ password: pwd });
      if (err) throw new Error(err.message);
      setPwd("");
      setConfirm("");
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
        <Lock size={14} />
        <span>Безопасность</span>
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <Field label="Новый пароль">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Минимум 8 символов"
            autoComplete="new-password"
            minLength={8}
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
          {tooShort && (
            <div className="text-[12px] text-[var(--system-red)] mt-1">
              Минимум 8 символов
            </div>
          )}
        </Field>

        <Field label="Подтвердите">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повтори новый пароль"
            autoComplete="new-password"
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
          {mismatch && (
            <div className="text-[12px] text-[var(--system-red)] mt-1">
              Пароли не совпадают
            </div>
          )}
        </Field>

        {error && (
          <div className="text-[13px] text-[var(--system-red)] leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition flex items-center justify-center gap-2"
        >
          {savedAt && <Check size={16} />}
          {save.status === "saving"
            ? "Обновляем…"
            : save.status === "saved"
            ? "Пароль обновлён"
            : "Сменить пароль"}
        </button>
      </div>
    </form>
  );
}

// ─── 2FA ───────────────────────────────────────────────────────

function TwoFactorBlock() {
  const [hasTotp, setHasTotp] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified") ?? null;
      setHasTotp(!!verified);
      setTotpFactorId(verified?.id ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDisable = async () => {
    if (!totpFactorId || busy) return;
    setShowDisableConfirm(false);
    setBusy(true);
    try {
      const sb = getSupabaseBrowser();
      await sb.auth.mfa.unenroll({ factorId: totpFactorId });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
        <Shield size={14} />
        <span>Двухфакторная аутентификация</span>
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        {/* TOTP — main, fully working */}
        <FactorRow
          icon={hasTotp ? <ShieldCheck size={18} className="text-[var(--system-green)]" /> : <Shield size={18} />}
          title="Приложение-аутентификатор"
          subtitle={
            hasTotp
              ? "Подключено. При входе нужен 6-значный код из приложения."
              : "Самый безопасный способ. Google Authenticator, Authy, 1Password, Yandex Key."
          }
          right={
            loading ? (
              <span className="text-[12px] text-[var(--label-tertiary)]">…</span>
            ) : hasTotp ? (
              <button
                type="button"
                onClick={() => setShowDisableConfirm(true)}
                disabled={busy}
                className="h-11 px-4 rounded-[10px] bg-[var(--system-red-tint)] border border-[var(--system-red-border)] text-[var(--system-red)] text-[13px] font-semibold active:bg-[var(--system-red-tint-pressed)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
              >
                Отключить
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowEnroll(true)}
                className="h-11 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:scale-[0.98]"
              >
                Подключить
              </button>
            )
          }
        />

        {/* Email — placeholder */}
        <FactorRow
          icon={<Mail size={18} className="text-[var(--label-tertiary)]" />}
          title="Код на email"
          subtitle="Babun будет присылать 6-значный код на твою почту при каждом входе."
          right={<ComingSoonPill />}
        />

        {/* SMS — placeholder */}
        <FactorRow
          icon={<Phone size={18} className="text-[var(--label-tertiary)]" />}
          title="Код по SMS"
          subtitle="Код приходит в SMS на привязанный номер. Менее безопасно чем приложение, но надёжнее пароля."
          right={<ComingSoonPill />}
        />
      </div>

      {showEnroll && (
        <TotpEnrollDialog
          onClose={() => setShowEnroll(false)}
          onSuccess={async () => {
            setShowEnroll(false);
            await refresh();
          }}
        />
      )}
      {showDisableConfirm && (
        <ConfirmDialog
          title="Отключить 2FA?"
          message="Аккаунт станет менее защищён. Снова подключить можно будет в любой момент."
          confirmLabel="Отключить"
          cancelLabel="Отмена"
          danger
          onConfirm={handleDisable}
          onClose={() => setShowDisableConfirm(false)}
        />
      )}
    </>
  );
}

function FactorRow({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-[10px] bg-[var(--fill-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[var(--label)]">{title}</div>
        <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
          {subtitle}
        </div>
      </div>
      <div className="shrink-0 self-center">{right}</div>
    </div>
  );
}

function ComingSoonPill() {
  return (
    <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-[var(--fill-tertiary)] text-[10px] uppercase tracking-wider font-bold text-[var(--label-tertiary)]">
      Скоро
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
