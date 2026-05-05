"use client";

// STORY-072 — Three-tab auth UI used by both /login and /register.
//
// Tabs:
//   * Email + код    → passwordless OTP via email
//   * Email + пароль → existing email/password (default)
//   * Телефон        → SMS OTP via Twilio (Supabase phone auth)
//
// Wraps the existing email/password form when "Email + пароль" is
// active. Otherwise shows a single-input form (email or phone) which
// fires the OTP request and swaps to OtpVerifyForm.

import { useState } from "react";
import { useRouter } from "next/navigation";
import OtpVerifyForm from "./OtpVerifyForm";
import {
  sendEmailOtp,
  sendPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "@/lib/supabase/auth-client";

type Tab = "email-otp" | "email-password" | "phone";

interface Props {
  /** Tab to show first. login + register can pick different defaults. */
  defaultTab?: Tab;
  /** Render prop for the email+password tab — keeps the existing
   *  form's logic intact (different between login/register). */
  passwordTab: React.ReactNode;
  /** "Войти" / "Регистрация" — labels for OTP submit buttons. */
  variant: "login" | "register";
}

export default function AuthTabs({
  defaultTab = "email-otp",
  passwordTab,
  variant,
}: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  return (
    <div className="space-y-3">
      <TabBar tab={tab} setTab={setTab} />
      {tab === "email-otp" && <EmailOtpFlow variant={variant} />}
      {tab === "email-password" && <div className="space-y-3">{passwordTab}</div>}
      {tab === "phone" && <PhoneOtpFlow variant={variant} />}
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: Array<{ id: Tab; label: string }> = [
    { id: "email-otp", label: "Email" },
    { id: "phone", label: "Телефон" },
    { id: "email-password", label: "Пароль" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 bg-[var(--fill-tertiary)] rounded-[10px] p-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => setTab(it.id)}
          className={`h-9 text-[13px] font-semibold rounded-[8px] transition ${
            tab === it.id
              ? "bg-[var(--surface-card)] text-[var(--label)] shadow-sm"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ─── Email OTP flow ──────────────────────────────────────────────
function EmailOtpFlow({ variant }: { variant: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"input" | "verify">("input");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { ok, error: err } = await sendEmailOtp(email.trim());
    setBusy(false);
    if (!ok) {
      setError(err ?? "Не удалось отправить код");
      return;
    }
    setStage("verify");
  };

  if (stage === "verify") {
    return (
      <OtpVerifyForm
        channel="email"
        destination={email}
        onVerify={(code) => verifyEmailOtp(email, code)}
        onResend={() => sendEmailOtp(email)}
        onBack={() => setStage("input")}
        onSuccess={() => {
          router.push("/dashboard/clients");
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
        />
      </div>
      {error && (
        <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
      >
        {busy
          ? "Отправляем…"
          : variant === "register"
            ? "Получить код для регистрации"
            : "Получить код для входа"}
      </button>
      <p className="text-[11px] text-[var(--label-tertiary)] text-center leading-snug">
        Отправим 6-значный код на почту. Пароль не нужен.
      </p>
    </form>
  );
}

// ─── Phone OTP flow ──────────────────────────────────────────────
//
// Phone format: E.164 (e.g. +35799123456). We don't enforce a country
// code prefix here because tenants will sign up from different
// countries. The `tel` input lets mobile keyboards render the numeric
// pad. Validation defers to Supabase / Twilio which return clean
// errors for malformed numbers.
function PhoneOtpFlow({ variant }: { variant: "login" | "register" }) {
  const router = useRouter();
  const [phone, setPhone] = useState("+357");
  const [stage, setStage] = useState<"input" | "verify">("input");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = phone.replace(/\s/g, "");
    if (!/^\+\d{8,15}$/.test(trimmed)) {
      setError("Номер в формате +XXXXXXXXXX (с кодом страны)");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, error: err } = await sendPhoneOtp(trimmed);
    setBusy(false);
    if (!ok) {
      setError(err ?? "Не удалось отправить SMS");
      return;
    }
    setPhone(trimmed);
    setStage("verify");
  };

  if (stage === "verify") {
    return (
      <OtpVerifyForm
        channel="phone"
        destination={phone}
        onVerify={(code) => verifyPhoneOtp(phone, code)}
        onResend={() => sendPhoneOtp(phone)}
        onBack={() => setStage("input")}
        onSuccess={() => {
          router.push("/dashboard/clients");
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+357 99 123 456"
          required
          className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent tabular-nums"
        />
      </div>
      {error && (
        <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
      >
        {busy
          ? "Отправляем SMS…"
          : variant === "register"
            ? "Получить код для регистрации"
            : "Получить код для входа"}
      </button>
      <p className="text-[11px] text-[var(--label-tertiary)] text-center leading-snug">
        Отправим SMS с 6-значным кодом. Тариф оператора может списать стоимость
        SMS — со стороны Babun отправка бесплатна.
      </p>
    </form>
  );
}
