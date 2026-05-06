"use client";

// STORY-070 — manual SMS balance grant. Owner uses this for support
// (refund a comp'd batch) or partner perks. Audit row is inserted in
// sms_topups so the trail isn't lost.

import { useState, useTransition } from "react";
import { grantSmsBalance } from "@/app/admin/actions";
import { haptic } from "@/lib/haptics";

const PRESETS = [10, 50, 100, 500];

export default function GrantBalanceForm({ tenantId }: { tenantId: string }) {
  const [credits, setCredits] = useState(50);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await grantSmsBalance(tenantId, credits, reason);
      if (!res.ok) setError(res.error);
      else {
        haptic("medium");
        setSuccess(true);
        setReason("");
      }
    });
  };

  return (
    <div className="pt-3 border-t border-[var(--separator)] space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        Добавить SMS вручную
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setCredits(p)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition tabular-nums ${
              credits === p
                ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
            }`}
          >
            +{p}
          </button>
        ))}
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(parseInt(e.target.value, 10) || 0)}
          min={1}
          max={10000}
          className="w-20 h-8 px-2 text-[12px] tabular-nums bg-[var(--surface-card)] border border-[var(--separator)] rounded-full focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Причина (для аудита)"
        maxLength={140}
        aria-label="Причина начисления"
        className="w-full h-11 px-3 text-[13px] bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]"
      />
      {error && <p className="text-[12px] text-[var(--system-red)]">{error}</p>}
      {success && (
        <p className="text-[12px] text-[var(--system-green)]">
          Зачислено. История обновится после перезагрузки страницы.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending || credits <= 0 || reason.trim().length === 0}
        className="h-11 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
      >
        {pending ? "Начисляем…" : `Начислить ${credits} SMS`}
      </button>
    </div>
  );
}
