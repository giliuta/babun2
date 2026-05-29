"use client";

/**
 * ServicesCard — УСЛУГИ row with the income folded in (Variant B).
 * Shows the service name (or "N услуг") + duration, and the total price
 * on the right. Tapping the row opens the service picker; tapping the
 * price opens IncomePopup for price/discount editing.
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";
import { formatEUR } from "@babun/shared/common/utils/money";

interface ServicesCardProps {
  readonly: boolean;
  serviceCount: number;
  firstServiceName?: string;
  total: number;
  durationMinutes: number;
  onTap?: () => void;
  onIncomeTap?: () => void;
}

/** Pluralise "услуга" in Russian. */
function pluralService(n: number): string {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 19) return `${n} услуг`;
  if (n10 === 1) return `${n} услуга`;
  if (n10 >= 2 && n10 <= 4) return `${n} услуги`;
  return `${n} услуг`;
}

export default function ServicesCard({
  readonly,
  serviceCount,
  firstServiceName,
  total,
  durationMinutes,
  onTap,
  onIncomeTap,
}: ServicesCardProps) {
  const hasServices = serviceCount > 0;

  const value = hasServices
    ? serviceCount === 1
      ? (firstServiceName ?? "1 услуга")
      : pluralService(serviceCount)
    : readonly
      ? "Не указаны"
      : "Выбрать услугу";

  const sub = hasServices ? `${durationMinutes} мин` : undefined;

  const priceAccessory = hasServices ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!readonly) onIncomeTap?.();
      }}
      aria-label="Цена и скидка"
      className="text-[15px] font-semibold text-[var(--label)] tabular-nums px-1.5 py-1 rounded-lg active:bg-[var(--fill-quaternary)]"
    >
      {formatEUR(total)}
    </button>
  ) : undefined;

  return (
    <SectionCard>
      <AppointmentRow
        label="УСЛУГИ"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></svg>}
        tileClass="bg-[var(--tile-cyan)]"
        value={value}
        accent={!hasServices && !readonly}
        sub={sub}
        onTap={readonly ? undefined : onTap}
        rightAccessory={priceAccessory}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
