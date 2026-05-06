"use client";

// STORY-074 — Region + currency selectors.
//
// Country drives sane defaults (currency, time zone, tax presence)
// later — for now it's just stored. Currency picker affects display
// in finances + SMS pricing.

import { useState, useTransition } from "react";
import { Globe, Banknote } from "@babun/shared/icons";
import { updateTenantBrand } from "@/app/dashboard/settings/account/brand-action";

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "CY", label: "Кипр" },
  { code: "RU", label: "Россия" },
  { code: "UA", label: "Украина" },
  { code: "GR", label: "Греция" },
  { code: "GB", label: "Великобритания" },
  { code: "DE", label: "Германия" },
  { code: "PL", label: "Польша" },
  { code: "TR", label: "Турция" },
  { code: "AE", label: "ОАЭ" },
  { code: "US", label: "США" },
  { code: "OT", label: "Другая" },
];

const CURRENCIES: Array<{ code: "EUR" | "USD" | "RUB" | "UAH" | "GBP"; label: string; symbol: string }> = [
  { code: "EUR", label: "Евро", symbol: "€" },
  { code: "USD", label: "Доллар США", symbol: "$" },
  { code: "RUB", label: "Российский рубль", symbol: "₽" },
  { code: "UAH", label: "Украинская гривна", symbol: "₴" },
  { code: "GBP", label: "Британский фунт", symbol: "£" },
];

interface Props {
  initialCountry: string;
  initialCurrency: "EUR" | "USD" | "RUB" | "UAH" | "GBP";
}

export default function RegionSection({
  initialCountry,
  initialCurrency,
}: Props) {
  const [country, setCountry] = useState(initialCountry || "CY");
  const [currency, setCurrency] =
    useState<"EUR" | "USD" | "RUB" | "UAH" | "GBP">(initialCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const persist = (next: { country?: string; currency?: typeof currency }) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateTenantBrand(next);
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Регион и валюта
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        <label className="flex items-center gap-3 px-4 h-12">
          <Globe size={16} className="text-[var(--label-secondary)] shrink-0" />
          <span className="w-[90px] text-[12px] text-[var(--label-secondary)] shrink-0">
            Страна
          </span>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              persist({ country: e.target.value });
            }}
            disabled={isPending}
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] focus:outline-none appearance-none cursor-pointer"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 px-4 h-12">
          <Banknote size={16} className="text-[var(--label-secondary)] shrink-0" />
          <span className="w-[90px] text-[12px] text-[var(--label-secondary)] shrink-0">
            Валюта
          </span>
          <select
            value={currency}
            onChange={(e) => {
              const v = e.target.value as typeof currency;
              setCurrency(v);
              persist({ currency: v });
            }}
            disabled={isPending}
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] focus:outline-none appearance-none cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="px-4 mt-2 text-[11px] text-[var(--label-secondary)] leading-snug">
        Часовой пояс и рабочие часы — в{" "}
        <a href="/dashboard/settings/calendar" className="text-[var(--accent)]">
          настройках календаря
        </a>
        .
      </div>

      {error && (
        <div className="px-4 mt-2 text-[12px] text-[var(--system-red)] leading-snug">
          {error}
        </div>
      )}
      {saved && (
        <div className="px-4 mt-2 text-[12px] text-[var(--system-green)] leading-snug">
          Сохранено ✓
        </div>
      )}
    </div>
  );
}
