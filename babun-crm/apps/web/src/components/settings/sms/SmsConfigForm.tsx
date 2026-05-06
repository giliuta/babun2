"use client";

// STORY-047 G5 — SMS configuration form (Owner-only).
//
// One section that owns:
//   * mode toggle (platform / BYOK)
//   * platform-mode quota indicator
//   * BYOK Twilio credential inputs (token shown as masked dots
//     when one is already configured; user retypes only to update)
//   * enable + 24h + 2h toggles
//   * tabs for the two templates with live preview + placeholder
//     helper buttons (delegated to <TemplateEditor />)
//
// Save is a server action (`saveSmsConfig`) that bypasses PostgREST
// RLS via service-role for the upsert, since the table has no SELECT
// policy for authenticated (token shielding — see G1 migration).
//
// Phone-first layout: max-w-xl, stacked vertically, 44 px tap
// targets for toggles, full-width Save button at the bottom.

import { useState, useTransition } from "react";
import { saveSmsConfig } from "@/app/dashboard/settings/sms/actions";
import type { SmsConfigInitial, SmsMode } from "./types";
import TemplateEditor from "./TemplateEditor";

interface Props {
  // tenantId is intentionally NOT a prop. The server action reads
  // it from the user's JWT (single source of truth) — passing it
  // through the client would invite future maintainers to trust
  // the prop value and undermine the security model.
  businessName: string;
  initial: SmsConfigInitial;
}

export default function SmsConfigForm({ businessName, initial }: Props) {
  const [mode, setMode] = useState<SmsMode>(initial.mode);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [remind24, setRemind24] = useState(initial.remind_24h_before);
  const [remind2, setRemind2] = useState(initial.remind_2h_before);
  const [accountSid, setAccountSid] = useState(initial.twilio_account_sid ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial.twilio_phone_number ?? "");
  // The token is NEVER seeded from the server. Empty string means
  // "don't change" (existing token stays). User retypes to update.
  const [authToken, setAuthToken] = useState("");
  const [tpl24, setTpl24] = useState(initial.template_24h);
  const [tpl2, setTpl2] = useState(initial.template_2h);

  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const tokenAlreadyConfigured = initial.twilio_auth_token_configured;
  const quotaPct =
    initial.free_quota_per_month > 0
      ? Math.min(100, Math.round((initial.sent_this_month / initial.free_quota_per_month) * 100))
      : 0;

  const onSave = () => {
    setErrorMsg(null);
    setSavedAt(null);
    startTransition(async () => {
      const r = await saveSmsConfig({
        mode,
        enabled,
        remind_24h_before: remind24,
        remind_2h_before: remind2,
        template_24h: tpl24,
        template_2h: tpl2,
        twilio_account_sid: accountSid,
        twilio_phone_number: phoneNumber,
        twilio_auth_token: authToken,
      });
      if (r.ok) {
        setSavedAt(Date.now());
        // Clear the token field so the masked-dots state re-applies.
        setAuthToken("");
      } else {
        setErrorMsg(humanizeError(r.error));
      }
    });
  };

  return (
    <section className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-5">
      <header>
        <h2 className="text-[17px] font-semibold text-[var(--label)]">
          SMS-напоминания
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Автоматическая отправка за 24 ч и за 2 ч до визита.
        </p>
      </header>

      {/* Mode selection */}
      <div>
        <label className="block text-[12px] uppercase tracking-wide text-[var(--label-secondary)] mb-2">
          Отправитель
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={mode === "platform"}
            onClick={() => setMode("platform")}
            title="Babun"
            subtitle={`Включено в тариф · ${initial.free_quota_per_month}/мес`}
          />
          <ModeButton
            active={mode === "byok"}
            onClick={() => setMode("byok")}
            title="Свой Twilio"
            subtitle="Свой номер и оплата напрямую"
          />
        </div>
      </div>

      {/* Platform-mode quota */}
      {mode === "platform" && (
        <div>
          <div className="flex items-center justify-between text-[13px] mb-1.5">
            <span className="text-[var(--label-secondary)]">
              {initial.sent_this_month} / {initial.free_quota_per_month} в этом месяце
            </span>
            <span className="text-[var(--label-secondary)]">{quotaPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--fill-primary)] overflow-hidden">
            <div
              className="h-full bg-[var(--system-blue)] transition-all"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          {quotaPct >= 80 && (
            <button
              type="button"
              disabled
              className="mt-2 w-full h-9 rounded-full bg-[var(--system-blue)] text-white text-[13px] font-semibold opacity-60 cursor-not-allowed"
            >
              Перейти на Pro (скоро)
            </button>
          )}
        </div>
      )}

      {/* BYOK fields */}
      {mode === "byok" && (
        <div className="space-y-3">
          <Field
            label="Account SID"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accountSid}
            onChange={setAccountSid}
            autoCapitalize="none"
          />
          <Field
            label="Auth Token"
            type="password"
            placeholder={
              tokenAlreadyConfigured
                ? "•••••••• (введите, чтобы изменить)"
                : "Скопируйте из Twilio Console"
            }
            value={authToken}
            onChange={setAuthToken}
            autoCapitalize="none"
          />
          <Field
            label="Номер отправителя"
            placeholder="+357..."
            value={phoneNumber}
            onChange={setPhoneNumber}
            inputMode="tel"
          />
        </div>
      )}

      {/* Enable + reminder toggles */}
      <div className="space-y-2">
        <Toggle
          label="Включить SMS-напоминания"
          checked={enabled}
          onChange={setEnabled}
        />
        <Toggle
          label="Напоминать за 24 часа"
          checked={remind24}
          onChange={setRemind24}
          disabled={!enabled}
        />
        <Toggle
          label="Напоминать за 2 часа"
          checked={remind2}
          onChange={setRemind2}
          disabled={!enabled}
        />
      </div>

      {/* Templates */}
      <TemplateEditor
        template24h={tpl24}
        template2h={tpl2}
        onChange24h={setTpl24}
        onChange2h={setTpl2}
        businessName={businessName}
      />

      {/* Save / status */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="w-full h-11 rounded-full bg-[var(--system-blue)] text-white text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:opacity-70 transition"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        {errorMsg && (
          <div className="text-[13px] text-[var(--system-red,#FF3B30)]">{errorMsg}</div>
        )}
        {savedAt && !errorMsg && (
          <div className="text-[13px] text-[var(--label-secondary)]">
            Сохранено
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-[12px] border transition ${
        active
          ? "border-[var(--system-blue)] bg-[var(--system-blue)]/8"
          : "border-[var(--separator)] bg-[var(--surface-card-secondary)]"
      }`}
    >
      <div className={`text-[14px] font-semibold ${active ? "text-[var(--system-blue)]" : "text-[var(--label)]"}`}>
        {title}
      </div>
      <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">{subtitle}</div>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "tel" | "text" | "email";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <label className="block">
      <span className="block text-[12px] uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete="off"
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card-secondary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-secondary)] outline-none focus:ring-2 focus:ring-[var(--system-blue)]/30"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between h-11 px-3 rounded-[10px] bg-[var(--surface-card-secondary)] transition ${
        disabled ? "opacity-50" : "active:opacity-70"
      }`}
    >
      <span className="text-[14px] text-[var(--label)]">{label}</span>
      <span
        className={`relative inline-block w-[42px] h-[26px] rounded-full transition ${
          checked ? "bg-[var(--system-green,#34C759)]" : "bg-[var(--fill-primary)]"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[16px]" : ""
          }`}
        />
      </span>
    </button>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case "unauthorized":
      return "Сессия истекла. Перезайдите.";
    case "owner_only":
      return "Только владелец может изменять настройки SMS.";
    case "tenant_missing":
      return "Не удалось определить рабочее пространство.";
    case "byok_incomplete":
      return "Заполните все три поля Twilio (SID, токен, номер).";
    default:
      return `Не сохранилось: ${code}`;
  }
}
