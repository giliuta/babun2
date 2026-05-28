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
