"use client";

// STORY-070 — manual plan-override picker on tenant detail. Uses a
// segmented control of Free / Pro / Business / Lifetime, plus a
// "Снять override" reset that nulls plan_override (Stripe state
// becomes the source of truth again).

import { useState, useTransition } from "react";
import { setTenantPlanOverride } from "@/app/admin/actions";
import { haptic } from "@/lib/haptics";

type Override = "free" | "pro" | "business" | "lifetime";

const CHOICES: Override[] = ["free", "pro", "business", "lifetime"];

export default function TenantPlanForm({
  tenantId,
  current,
}: {
  tenantId: string;
  current: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (next: Override | null) => {
    setError(null);
    startTransition(async () => {
      const res = await setTenantPlanOverride(tenantId, next);
      if (!res.ok) setError(res.error);
      else haptic("medium");
    });
  };

  return (
    <div className="pt-3 border-t border-[var(--separator)]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
        Override плана
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHOICES.map((c) => {
          const active = current === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => apply(c)}
              disabled={pending}
              className={`h-9 px-3 rounded-full text-[12px] font-semibold transition uppercase tracking-wide ${
                active
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
              } ${pending ? "opacity-50 cursor-wait" : ""}`}
            >
              {c}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => apply(null)}
          disabled={pending || current === null}
          className="h-9 px-3 rounded-full text-[12px] font-semibold text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)] disabled:opacity-30"
        >
          Снять
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-[var(--system-red)]">{error}</p>
      )}
      <p className="mt-2 text-[11px] text-[var(--label-secondary)] leading-snug">
        Override побеждает Stripe-план. Используй для жалующихся клиентов, lifetime-grants (AirFix), партнёров. «Снять» возвращает контроль Stripe-у.
      </p>
    </div>
  );
}
