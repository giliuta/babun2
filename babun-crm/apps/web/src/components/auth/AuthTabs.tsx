"use client";

// STORY-072 — Single-input auth flow.
//
// One field: "Email или телефон". Auto-detects:
//   - starts with "+" or all-digits → phone OTP via SMS
//   - contains "@"                  → email OTP
//
// Falls back to a tiny "Войти по паролю" toggle for legacy users
// who registered with email + password and didn't migrate to OTP.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OtpVerifyForm from "./OtpVerifyForm";
import {
  sendEmailOtp,
  sendPhoneOtp,
  signIn,
  signUp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "@/lib/supabase/auth-client";

interface Props {
  variant: "login" | "register";
}

type Mode = "quick" | "password";

export default function AuthTabs({ variant }: Props) {
  const [mode, setMode] = useState<Mode>("quick");
  return (
    <div className="space-y-3">
      {mode === "quick" ? (
        <QuickFlow variant={variant} />
      ) : (
        <PasswordFlow variant={variant} />
      )}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "quick" ? "password" : "quick"))}
        className="block w-full text-center h-10 leading-[40px] text-[13px] text-[var(--label-secondary)] active:opacity-60"
      >
        {mode === "quick" ? "Войти по паролю" : "← Войти по коду"}
      </button>
    </div>
  );
}

// ─── Quick flow: one input → email or phone OTP ──────────────────
function QuickFlow({ variant }: { variant: "login" | "register" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<"input" | "verify">("input");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [normalized, setNormalized] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = (raw: string): { kind: "email" | "phone"; value: string } | null => {
    const t = raw.trim();
    if (!t) return null;
    if (t.includes("@")) {
      // very loose email check — server will reject malformed
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
      return ok ? { kind: "email", value: t.toLowerCase() } : null;
    }
    // phone: normalize spaces and dashes; require leading + and 8-15 digits
    const cleaned = t.replace(/[\s\-()]/g, "");
    if (/^\+\d{8,15}$/.test(cleaned)) return { kind: "phone", value: cleaned };
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const detected = detect(value);
    if (!detected) {
      setError("Введи email (например you@gmail.com) или телефон с кодом страны (+357 99 12 34 56)");
      return;
    }
    setError(null);
    setBusy(true);
    const send = detected.kind === "email" ? sendEmailOtp : sendPhoneOtp;
    const { ok, error: err } = await send(detected.value);
    setBusy(false);
    if (!ok) {
      setError(err ?? "Не удалось отправить код");
      return;
    }
    setChannel(detected.kind);
    setNormalized(detected.value);
    setStage("verify");
  };

  if (stage === "verify") {
    return (
      <OtpVerifyForm
        channel={channel}
        destination={normalized}
        onVerify={(code) =>
          channel === "email"
            ? verifyEmailOtp(normalized, code)
            : verifyPhoneOtp(normalized, code)
        }
        onResend={() =>
          channel === "email" ? sendEmailOtp(normalized) : sendPhoneOtp(normalized)
        }
        onBack={() => setStage("input")}
        onSuccess={() => {
          router.push("/dashboard/clients");
          router.refresh();
        }}
      />
    );
  }

  const cta =
    variant === "register" ? "Получить код для регистрации" : "Получить код для входа";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
        <input
          type="text"
          autoComplete="email"
          inputMode="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Email или +телефон"
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
        {busy ? "Отправляем код…" : cta}
      </button>
      <p className="text-[11px] text-[var(--label-tertiary)] text-center leading-snug">
        Отправим 6-значный код. Email — бесплатно. SMS — может списаться по тарифу оператора.
      </p>
    </form>
  );
}

// ─── Password flow: legacy email + password ──────────────────────
function PasswordFlow({ variant }: { variant: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    if (variant === "register") {
      const { ok, error: err } = await signUp(
        email,
        password,
        businessName.trim() || undefined,
      );
      if (!ok) {
        setError(err ?? "Не удалось создать аккаунт");
        setLoading(false);
        return;
      }
      const supabase = (await import("@/lib/supabase/client")).getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard/clients");
        router.refresh();
      } else {
        setPending(true);
        setLoading(false);
      }
    } else {
      const { ok, error: err } = await signIn(email, password);
      if (!ok) {
        setError(err ?? "Не удалось войти");
        setLoading(false);
        return;
      }
      router.push("/dashboard/clients");
      router.refresh();
    }
  };

  if (pending) {
    return (
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-[14px] text-[var(--label-secondary)] leading-relaxed">
        На <span className="text-[var(--label)] font-medium">{email}</span>{" "}
        ушло письмо со ссылкой. Открой его, перейди по ссылке — и
        возвращайся сюда, чтобы войти.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--separator)] shadow-[var(--shadow-card)]">
        {variant === "register" && (
          <input
            type="text"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Название бизнеса (необязательно)"
            maxLength={120}
            className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
        )}
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full h-12 px-4 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
        />
        <input
          type="password"
          autoComplete={variant === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={variant === "register" ? "Пароль (минимум 8 символов)" : "Пароль"}
          required
          minLength={8}
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
        disabled={loading}
        className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
      >
        {loading
          ? variant === "register"
            ? "Создаём…"
            : "Входим…"
          : variant === "register"
            ? "Создать аккаунт"
            : "Войти"}
      </button>

      {variant === "login" && (
        <Link
          href="/forgot-password"
          className="block text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60"
        >
          Забыли пароль?
        </Link>
      )}
    </form>
  );
}
