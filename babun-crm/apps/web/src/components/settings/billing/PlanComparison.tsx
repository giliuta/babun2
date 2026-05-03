"use client";

// STORY-052 G5 — plan comparison + Checkout CTAs.
//
// Renders only when the tenant is on Free + has no plan_override.
// 3 cards stacked (phone-first), each lists features. Pro/Business
// cards have a "Перейти" button that calls createCheckoutSession
// and redirects to the Stripe-hosted Checkout page. 14-day trial
// is the default per locked spec.

import { useTransition } from "react";
import { createCheckoutSession } from "@/app/dashboard/settings/billing/actions";
import type { BillingTier } from "@/app/dashboard/settings/billing/actions";
import { useToast } from "@/components/ui/Toast";
import type { Plan } from "./types";

interface Props {
  currentPlan: Plan;
}

const FEATURES: Record<
  "free" | BillingTier,
  { title: string; price: string; rows: string[]; primary?: boolean }
> = {
  free: {
    title: "Бесплатный",
    price: "€0 / мес",
    rows: ["100 клиентов", "50 записей в месяц", "10 SMS / мес", "1 пользователь"],
  },
  pro: {
    title: "Pro",
    price: "€15 / мес",
    rows: [
      "1 000 клиентов",
      "Безлимит записей",
      "200 SMS / мес",
      "До 5 членов команды",
    ],
    primary: true,
  },
  business: {
    title: "Business",
    price: "€40 / мес",
    rows: [
      "Безлимит клиентов и записей",
      "Свой Twilio (брендовые SMS)",
      "Безлимит команды",
      "Приоритетная поддержка",
    ],
  },
};

export default function PlanComparison({ currentPlan }: Props) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-[15px] uppercase tracking-wide text-[var(--label-secondary)]">
          Сравнение тарифов
        </h2>
        <p className="text-[12px] text-[var(--label-secondary)] mt-1">
          14 дней бесплатно при переходе на Pro или Business — отменишь,
          если не понравится.
        </p>
      </header>

      <Card name="free" current={currentPlan === "free"} />
      <Card name="pro" current={currentPlan === ("pro" as Plan)} />
      <Card name="business" current={currentPlan === ("business" as Plan)} />
    </section>
  );
}

function Card({ name, current }: { name: "free" | BillingTier; current: boolean }) {
  const meta = FEATURES[name];
  const isPaid = name !== "free";
  const [pending, start] = useTransition();
  const toast = useToast();

  const onUpgrade = () => {
    if (!isPaid) return;
    start(async () => {
      const r = await createCheckoutSession({ tier: name as BillingTier });
      if (r.ok) {
        window.location.href = r.data.url;
      } else {
        toast.show({
          variant: "error",
          message: humanizeUpgradeError(r.error),
        });
      }
    });
  };

  return (
    <div
      className={`bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-3 ${
        meta.primary ? "ring-2 ring-[var(--system-blue)]/30" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-[17px] font-semibold text-[var(--label)]">
          {meta.title}
        </h3>
        <span className="text-[15px] font-semibold text-[var(--label)]">
          {meta.price}
        </span>
      </div>
      <ul className="space-y-1 text-[13px] text-[var(--label-secondary)]">
        {meta.rows.map((row) => (
          <li key={row} className="flex items-baseline gap-2">
            <span aria-hidden className="text-[var(--system-blue)]">
              •
            </span>
            <span>{row}</span>
          </li>
        ))}
      </ul>
      {current ? (
        <div className="text-[13px] text-[var(--label-secondary)] text-center pt-2">
          Активен сейчас
        </div>
      ) : isPaid ? (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={pending}
          className={`w-full h-11 rounded-full text-[15px] font-semibold disabled:opacity-50 active:opacity-70 transition ${
            meta.primary
              ? "bg-[var(--system-blue)] text-white"
              : "bg-[var(--surface-card-secondary)] text-[var(--label)]"
          }`}
        >
          {pending ? "Открываем Stripe…" : `Перейти на ${meta.title}`}
        </button>
      ) : null}
    </div>
  );
}

function humanizeUpgradeError(code: string): string {
  switch (code) {
    case "stripe_not_configured":
      return "Платежи временно недоступны. Свяжитесь с поддержкой.";
    case "tax_not_configured":
      return "Налоговая настройка не завершена. Свяжитесь с поддержкой.";
    case "owner_only":
      return "Только владелец может изменять тариф.";
    case "tenant_missing":
      return "Не удалось определить рабочее пространство.";
    case "no_email_on_account":
      return "На аккаунте не указан email — добавь его в настройках.";
    default:
      return `Не удалось перейти: ${code}`;
  }
}
