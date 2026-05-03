"use client";

// STORY-052 G6 — top-of-page banner that nudges the Owner to upgrade
// when one or more quotas hit the warning threshold. Dismissible
// with a 24h localStorage cooldown — the banner re-appears the next
// session if the limit is still tight.
//
// Surfaces:
//   * green banner — at-or-above 100% (hard cap reached)
//   * orange banner — 80–99% (approaching limit)
//   * (none) — under 80% OR snapshot not loaded yet OR all quotas unlimited
//
// Edge cases:
//   * Business / Lifetime tenants → all quotas unlimited → never shows.
//   * past_due subscription is handled by PlanCard — independent UX.
//   * If the user just upgraded (we detect via plan !== 'free'), the
//     banner is hidden by the standard render check (their new
//     usage / new_quota ratio is fresh too).

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  isUnlimited,
  type EffectivePlan,
  type QuotaSummary,
  type UsageCounts,
} from "@/components/settings/billing/types";

const DISMISS_KEY = "babun:quota-banner-dismissed-at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface Props {
  plan: EffectivePlan;
  quotas: QuotaSummary;
  usage: UsageCounts;
  /** Restrict the banner to a single quota kind (e.g. only the
   *  clients-page banner cares about clients). When omitted, surfaces
   *  the worst quota across all four kinds. */
  scope?: keyof QuotaSummary;
}

const KIND_LABEL: Record<keyof QuotaSummary, string> = {
  clients: "клиентов",
  appointments_month: "записей в этом месяце",
  team_members: "членов команды",
  sms_month: "SMS в этом месяце",
};

export default function QuotaBanner({ plan, quotas, usage, scope }: Props) {
  const [dismissed, setDismissed] = useState(true);

  // Hydrate dismiss state from localStorage on mount. Initial state
  // is `dismissed=true` so SSR + first client render match (no
  // banner). Effect flips to the real value after hydration. Same
  // canonical Next pattern OfflineIndicator uses for the
  // hydration-safe gate; the lint rule is overly broad for this
  // intended SSR-safety pattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) {
        setDismissed(false);
        return;
      }
      const at = Number(raw);
      if (!Number.isFinite(at)) {
        setDismissed(false);
        return;
      }
      setDismissed(Date.now() - at < DISMISS_TTL_MS);
    } catch {
      setDismissed(false);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const worst = useMemo(() => {
    const kinds: Array<keyof QuotaSummary> = scope
      ? [scope]
      : ["clients", "appointments_month", "team_members", "sms_month"];
    let best: { kind: keyof QuotaSummary; pct: number } | null = null;
    for (const k of kinds) {
      const limit = quotas[k];
      if (isUnlimited(limit)) continue;
      const pct = limit > 0 ? (usage[k] / limit) * 100 : 0;
      if (!best || pct > best.pct) best = { kind: k, pct };
    }
    return best;
  }, [quotas, usage, scope]);

  if (dismissed) return null;
  if (!worst) return null;
  if (worst.pct < 80) return null;

  const atCap = worst.pct >= 100;
  const tone = atCap
    ? "bg-[var(--system-red,#FF3B30)]/12 text-[var(--system-red,#FF3B30)] border-[var(--system-red,#FF3B30)]/30"
    : "bg-[var(--system-orange,#FF9500)]/12 text-[var(--system-orange,#FF9500)] border-[var(--system-orange,#FF9500)]/30";
  const title = atCap
    ? `Достигнут лимит ${KIND_LABEL[worst.kind]} на тарифе ${planNameRu(plan)}.`
    : `Близко к лимиту ${KIND_LABEL[worst.kind]} на тарифе ${planNameRu(plan)}.`;

  const onDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore — private mode etc. */
    }
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className={`mx-3 mt-2 mb-3 rounded-[12px] border px-3 py-2 flex items-center gap-2 text-[13px] ${tone}`}
    >
      <span className="flex-1">{title}</span>
      <Link
        href="/dashboard/settings/billing"
        className="shrink-0 px-2.5 h-7 rounded-full bg-[var(--surface-card)] text-[12px] font-semibold flex items-center text-current"
      >
        Перейти на Pro
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть"
        className="shrink-0 w-7 h-7 rounded-full text-current opacity-70 active:opacity-100 transition"
      >
        ×
      </button>
    </div>
  );
}

function planNameRu(p: EffectivePlan): string {
  switch (p) {
    case "free":
      return "Free";
    case "pro":
      return "Pro";
    case "business":
      return "Business";
    case "lifetime":
      return "Lifetime";
    case "beta_unlimited":
      return "Beta";
  }
}
