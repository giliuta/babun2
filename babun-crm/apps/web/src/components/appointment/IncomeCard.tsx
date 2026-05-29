"use client";

/**
 * IncomeCard — always-visible fixed-height card showing total + duration.
 * Tap opens IncomePopup for price/discount editing. Always min-h-[76px].
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";
import { formatEUR } from "@babun/shared/common/utils/money";

interface IncomeCardProps {
  readonly: boolean;
  total: number;
  durationMinutes: number;
  hasServices: boolean;
  onTap?: () => void;
}

export default function IncomeCard({
  readonly,
  total,
  durationMinutes,
  hasServices,
  onTap,
}: IncomeCardProps) {
  const value = hasServices
    ? `${formatEUR(total)} · ${durationMinutes} мин`
    : `€0 · 0 мин`;

  const sub =
    hasServices && !readonly ? "Тап для правки цен и скидки" : undefined;

  return (
    <SectionCard>
      <AppointmentRow
        label="ДОХОД"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8a5 5 0 1 0 0 8" /><path d="M5 11h8M5 14h8" /></svg>}
        tileClass="bg-[var(--tile-green)]"
        value={value}
        // Muted style via accent=false + secondary colour handled by
        // AppointmentRow's default label colour; when no services, the
        // "€0" text is not accent but also not muted — neutral label.
        accent={false}
        sub={sub}
        onTap={hasServices && !readonly ? onTap : undefined}
        showChevron={hasServices && !readonly}
      />
    </SectionCard>
  );
}
