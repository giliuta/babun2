"use client";

/**
 * ServicesCard — summary-only card for УСЛУГИ. Shows "N услуг(а/и)"
 * or "Выбрать услугу" CTA. Detail lives in IncomePopup, not here.
 * Always min-h-[76px].
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface ServicesCardProps {
  readonly: boolean;
  serviceCount: number;
  firstServiceName?: string;
  onTap?: () => void;
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
  onTap,
}: ServicesCardProps) {
  const value =
    serviceCount > 0
      ? pluralService(serviceCount)
      : readonly
        ? "Не указаны"
        : "Выбрать услугу";

  const sub =
    serviceCount > 0 && firstServiceName
      ? firstServiceName
      : undefined;

  return (
    <SectionCard>
      <AppointmentRow
        label="УСЛУГИ"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></svg>}
        tileClass="bg-[var(--tile-cyan)]"
        value={value}
        accent={serviceCount === 0 && !readonly}
        sub={sub}
        onTap={readonly ? undefined : onTap}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
