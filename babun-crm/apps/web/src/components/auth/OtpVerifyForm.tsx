"use client";

// STORY-072 — Generic 6-digit OTP code verification UI.
//
// Used by both email-OTP and phone-OTP flows. Six separate
// input slots with auto-advance + paste support. Verifies via
// the channel-specific function passed in via props.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** What's being verified — for the title + resend label. */
  channel: "email" | "phone";
  /** The destination address (email or phone number) to display
   *  back to the user so they can verify they typed it correctly. */
  destination: string;
  /** Called with the 6-digit code. Returns { ok, error } shape. */
  onVerify: (code: string) => Promise<{ ok: boolean; error: string | null }>;
  /** Called when user clicks "resend code". */
  onResend: () => Promise<{ ok: boolean; error: string | null }>;
  /** Called when user clicks "← change" (go back). */
  onBack: () => void;
  /** Where to redirect on success. */
  onSuccess: () => void;
}

const RESEND_COOLDOWN_S = 30;

export default function OtpVerifyForm({
  channel,
  destination,
  onVerify,
  onResend,
  onBack,
  onSuccess,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_S);
  const [resentNotice, setResentNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { ok, error: err } = await onVerify(code);
    if (!ok) {
      setError(err ?? "Неверный код");
      setBusy(false);
      return;
    }
    onSuccess();
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setError(null);
    setResentNotice(false);
    const { ok, error: err } = await onResend();
    if (!ok) {
      setError(err ?? "Не удалось переотправить");
      return;
    }
    setResentNotice(true);
    setResendIn(RESEND_COOLDOWN_S);
  };

  const channelLabel = channel === "email" ? "почту" : "телефон";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 text-[14px] leading-snug">
        <div className="text-[var(--label-secondary)] mb-2">
          Мы отправили 6-значный код на твой {channelLabel}:
        </div>
        <div className="text-[var(--label)] font-semibold tabular-nums break-all">
          {destination}
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        required
        className="w-full h-[60px] text-center text-[28px] tracking-[0.4em] tabular-nums font-semibold text-[var(--label)] bg-[var(--surface-card)] rounded-[var(--radius-card)] border border-[var(--separator)] focus:outline-none focus:border-[var(--accent)] shadow-[var(--shadow-card)]"
      />

      {error && (
        <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}

      {resentNotice && !error && (
        <div className="text-[12px] text-[var(--system-green)] text-center">
          Код отправлен заново
        </div>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition mt-3"
      >
        {busy ? "Проверяем…" : "Подтвердить"}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={resendIn > 0 || busy}
        className="block w-full text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--accent)] active:opacity-60 disabled:text-[var(--label-tertiary)]"
      >
        {resendIn > 0 ? `Отправить код снова через ${resendIn}с` : "Отправить код снова"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center h-11 leading-[44px] text-[14px] font-medium text-[var(--label-secondary)] active:opacity-60"
      >
        ← Изменить {channel === "email" ? "почту" : "номер"}
      </button>
    </form>
  );
}
