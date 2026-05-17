"use client";

// Beta #52 (CRM Core brief) — client-side feedback form rendered by
// the public /feedback/[token] page.
//
// Five star buttons + free-text comment. Submit POSTs to
// /api/feedback/submit which inserts a master_ratings row carrying
// the token. The RLS policy from migration 20260517_004 enforces
// the «token must exist, be unused, and match tenant/master»
// invariant; our submit endpoint also wipes the token row on
// trigger fire so a refresh + resubmit can't double-rate.

import { useState } from "react";

interface Props {
  token: string;
  tenantId: string;
  masterId: string;
  appointmentId: string | null;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "ok" }
  | { status: "error"; message: string };

export default function FeedbackForm({
  token,
  tenantId,
  masterId,
  appointmentId,
}: Props) {
  const [stars, setStars] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const submit = async () => {
    if (stars < 1) return;
    setState({ status: "submitting" });
    const res = await fetch("/api/feedback/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        tenant_id: tenantId,
        master_id: masterId,
        appointment_id: appointmentId,
        stars,
        comment: comment.trim() || null,
      }),
    });
    if (res.ok) {
      setState({ status: "ok" });
    } else {
      let msg = `Ошибка ${res.status}`;
      try {
        const j = await res.json();
        msg = j.error ?? j.message ?? msg;
      } catch {
        // ignore
      }
      setState({ status: "error", message: msg });
    }
  };

  if (state.status === "ok") {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center">
        <div className="text-[36px] mb-2">✓</div>
        <h2 className="text-[17px] font-semibold text-[var(--label)]">
          Спасибо за оценку!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--label-secondary)] leading-snug">
          Команда увидит её прямо сейчас. Если что-то было не так — мы
          разберёмся.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-4">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2 text-center">
          Ваша оценка
        </div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} из 5`}
              onClick={() => setStars(n)}
              className={`w-12 h-12 rounded-full text-[28px] leading-none transition active:scale-[0.95] ${
                n <= stars
                  ? "text-[#FFCC00]"
                  : "text-[var(--label-quaternary)]"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5">
          Комментарий (по желанию)
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Расскажите, что понравилось или что улучшить"
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] resize-none leading-snug"
        />
      </div>

      {state.status === "error" && (
        <div className="text-[12px] text-[var(--system-red)] leading-snug">
          {state.message}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={stars < 1 || state.status === "submitting"}
        className="w-full h-12 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
      >
        {state.status === "submitting" ? "Отправляем…" : "Отправить отзыв"}
      </button>
    </div>
  );
}
