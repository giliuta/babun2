"use client";

// STORY-052 G5 — current plan card.
//
// Top of the billing page. Surfaces:
//   * effective plan name (with lifetime / beta override hint when present)
//   * subscription status badge
//   * trial countdown when trialing
//   * next-renewal date when active
//   * "Управлять подпиской" button → Stripe Customer Portal (only
//     when the tenant has a Stripe subscription; lifetime tenants
//     never see it)

import { useTransition } from "react";
import { createPortalSession } from "@/app/dashboard/settings/billing/actions";
import { useToast } from "@/components/ui/Toast";
import {
  planNameRu,
  statusNameRu,
  type BillingState,
} from "./types";

interface Props {
  billing: BillingState;
  stripeConfigured: boolean;
}

export default function PlanCard({ billing, stripeConfigured }: Props) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onManage = () => {
    if (!stripeConfigured) return;
    start(async () => {
      const r = await createPortalSession();
      if (r.ok) {
        window.location.href = r.data.url;
      } else {
        toast.show({
          variant: "error",
          message: humanizePortalError(r.error),
        });
      }
    });
  };

  const statusLabel = statusNameRu(billing.subscription_status);
  const statusTone = statusTonePill(billing.subscription_status);
  const planLabel = planNameRu(billing.effective_plan);

  return (
    <section className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-[var(--label-secondary)]">
            Текущий тариф
          </div>
          <div className="text-[24px] font-bold text-[var(--label)] mt-1">
            {planLabel}
          </div>
          {billing.is_overridden && (
            <div className="text-[12px] text-[var(--label-secondary)] mt-1">
              Бессрочный доступ — все возможности Business
            </div>
          )}
        </div>
        {statusLabel && (
          <span
            className={`px-2.5 h-7 rounded-full text-[12px] font-semibold flex items-center ${statusTone}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {billing.subscription_status === "trialing" && billing.trial_ends_at && (
        <div className="text-[13px] text-[var(--label-secondary)]">
          Пробный период до{" "}
          <span className="font-semibold text-[var(--label)]">
            {formatDateRu(billing.trial_ends_at)}
          </span>
        </div>
      )}
      {billing.subscription_status === "active" && billing.current_period_end && (
        <div className="text-[13px] text-[var(--label-secondary)]">
          Следующее списание{" "}
          <span className="font-semibold text-[var(--label)]">
            {formatDateRu(billing.current_period_end)}
          </span>
        </div>
      )}
      {billing.subscription_status === "past_due" && (
        <div className="text-[13px] text-[var(--system-orange,#FF9500)]">
          Платёж не прошёл — обнови способ оплаты в управлении подпиской.
        </div>
      )}

      {billing.has_stripe_subscription && stripeConfigured && (
        <button
          type="button"
          onClick={onManage}
          disabled={pending}
          className="w-full h-11 rounded-full bg-[var(--system-blue)] text-white text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:opacity-70 transition"
        >
          {pending ? "Открываем…" : "Управлять подпиской"}
        </button>
      )}
    </section>
  );
}

function statusTonePill(s: BillingState["subscription_status"]): string {
  switch (s) {
    case "active":
    case "trialing":
      return "bg-[var(--system-green,#34C759)]/15 text-[var(--system-green,#34C759)]";
    case "past_due":
      return "bg-[var(--system-orange,#FF9500)]/15 text-[var(--system-orange,#FF9500)]";
    case "canceled":
    case "incomplete":
      return "bg-[var(--system-red,#FF3B30)]/15 text-[var(--system-red,#FF3B30)]";
    default:
      return "bg-[var(--fill-primary)] text-[var(--label-secondary)]";
  }
}

function humanizePortalError(code: string): string {
  switch (code) {
    case "stripe_not_configured":
      return "Платежи временно недоступны.";
    case "owner_only":
      return "Только владелец может управлять подпиской.";
    default:
      return `Не удалось открыть управление: ${code}`;
  }
}

function formatDateRu(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
