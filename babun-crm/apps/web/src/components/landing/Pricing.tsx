import Link from "next/link";
import { Check } from "@babun/shared/icons";

// STORY-061 — three-tier pricing matching the real STORY-052 Stripe
// billing setup. Numbers mirror tenant_quota_* Postgres functions.
// Pro/Business get a "14 дней бесплатно" badge — Stripe Checkout
// already grants the trial via `subscription_data.trial_period_days`,
// no separate flag needed.
//
// Highlight: Pro tier (most teams' sweet spot). Card visually scales
// up + accent border so visitors see it first when scanning.

interface Tier {
  id: "free" | "pro" | "business";
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  trialBadge?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    cadence: "навсегда",
    tagline: "Самозанятый мастер, до 50 клиентов.",
    features: [
      "До 50 клиентов",
      "До 100 записей в месяц",
      "1 человек в команде",
      "PWA на iPhone и Android",
      "Импорт из CSV",
    ],
    cta: { label: "Начать бесплатно", href: "/register" },
  },
  {
    id: "pro",
    name: "Pro",
    price: "€15",
    cadence: "/ месяц",
    tagline: "Бригада из 2–5 мастеров. Самый частый выбор.",
    features: [
      "До 1 000 клиентов",
      "Безлимит записей",
      "До 5 человек в команде",
      "SMS-напоминания (свой Twilio)",
      "Финансы и отчёты",
      "Multi-device sync в реальном времени",
    ],
    cta: { label: "Попробовать 14 дней", href: "/register?plan=pro" },
    highlighted: true,
    trialBadge: true,
  },
  {
    id: "business",
    name: "Business",
    price: "€40",
    cadence: "/ месяц",
    tagline: "Сеть салонов или сервис на 6+ мастеров.",
    features: [
      "Безлимит клиентов и записей",
      "До 20 человек в команде",
      "SMS на платформе или своём Twilio",
      "Расширенная аналитика",
      "Приоритетная поддержка",
      "Все функции Pro",
    ],
    cta: { label: "Попробовать 14 дней", href: "/register?plan=business" },
    trialBadge: true,
  },
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-[var(--surface-card)] py-16 lg:py-24 border-y border-[var(--separator)]"
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-[28px] sm:text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)]">
            Простые и честные тарифы
          </h2>
          <p className="mt-3 text-[16px] lg:text-[17px] text-[#3C3C43D9] leading-snug">
            Начни бесплатно. Перейди на платный когда команда вырастет — без сюрпризов и скрытых лимитов.
          </p>
        </div>

        <div className="mt-10 lg:mt-14 grid lg:grid-cols-3 gap-4 lg:gap-6">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-[#3C3C43A6] max-w-xl mx-auto leading-snug">
          Цены в евро без НДС. Платёж через Stripe — Visa, Mastercard, Apple Pay, Google Pay. Отмена подписки в любой момент.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: Tier }) {
  const base =
    "relative bg-[var(--surface-grouped)] rounded-2xl p-6 lg:p-7 flex flex-col";
  const highlighted = tier.highlighted
    ? "ring-2 ring-[var(--accent)] lg:scale-[1.02] shadow-[0_8px_24px_rgba(31,102,215,0.12)]"
    : "ring-1 ring-[var(--separator)]";

  return (
    <div className={`${base} ${highlighted}`}>
      {tier.trialBadge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--accent)] text-white text-[11px] font-semibold tracking-wide uppercase">
          14 дней бесплатно
        </span>
      )}
      <h3 className="text-[18px] font-semibold tracking-tight text-[var(--label)]">
        {tier.name}
      </h3>
      <p className="mt-1 text-[13px] text-[#3C3C43A6] leading-snug min-h-[2.5em]">
        {tier.tagline}
      </p>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[36px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)]">
          {tier.price}
        </span>
        <span className="text-[14px] text-[#3C3C43A6]">{tier.cadence}</span>
      </div>

      <ul className="mt-6 space-y-2.5 flex-1">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[14px] text-[var(--label)] leading-snug"
          >
            <Check
              size={16}
              strokeWidth={2.5}
              className="flex-shrink-0 mt-0.5 text-[var(--accent)]"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={tier.cta.href}
        className={`mt-7 h-11 px-4 rounded-[12px] text-[15px] font-semibold flex items-center justify-center transition active:scale-[0.99] ${
          tier.highlighted
            ? "bg-[#1F66D7] text-white hover:bg-[#1850A8]"
            : "border border-[var(--separator)] text-[var(--label)] hover:bg-[var(--fill-quaternary)]"
        }`}
      >
        {tier.cta.label}
      </Link>
    </div>
  );
}
