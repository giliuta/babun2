"use client";

// STORY-037 G7 — defensive banner. Architectural decision A3 keeps
// "Confirm email" OFF in the Supabase Dashboard for now, so most
// users never see this. If the toggle ever flips back ON, this
// nudges the user to confirm without breaking the dashboard.

import { useState } from "react";
import { resendConfirmation } from "@/lib/supabase/auth-client";

interface Props {
  email: string;
}

export default function UnconfirmedEmailBanner({ email }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resend = async () => {
    if (sending || sent) return;
    setSending(true);
    setError("");
    const { ok, error: err } = await resendConfirmation(email);
    setSending(false);
    if (ok) {
      setSent(true);
    } else {
      setError(err ?? "Не удалось отправить");
    }
  };

  return (
    <div className="bg-[var(--system-orange-tint,rgba(255,149,0,0.12))] text-[var(--system-orange,#ff9500)] px-3 py-2 flex items-center gap-2 text-[13px]">
      <span className="flex-1 truncate">
        Подтверди email — мы отправили ссылку на{" "}
        <span className="font-medium">{email}</span>.
      </span>
      {sent ? (
        <span className="shrink-0 text-[12px] font-semibold">Отправлено</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="shrink-0 px-2 h-7 rounded-md bg-[var(--surface-card)] text-[var(--system-orange,#ff9500)] text-[12px] font-semibold disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
        >
          {sending ? "…" : "Ещё раз"}
        </button>
      )}
      {error && <span className="shrink-0 text-[12px]">{error}</span>}
    </div>
  );
}
