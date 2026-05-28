"use client";

/**
 * NavigationCard — fixed-height card for НАВИГАЦИЯ. Shows "Открыть в Maps"
 * accent CTA when address is set, or muted "Адрес не указан". Tap opens
 * MapNavPopup. Always min-h-[76px].
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface NavigationCardProps {
  hasAddress: boolean;
  onTap?: () => void;
}

export default function NavigationCard({
  hasAddress,
  onTap,
}: NavigationCardProps) {
  return (
    <SectionCard>
      <AppointmentRow
        label="НАВИГАЦИЯ"
        value={hasAddress ? "Открыть в Maps" : "Адрес не указан"}
        accent={hasAddress}
        onTap={hasAddress ? onTap : undefined}
        showChevron={hasAddress}
      />
    </SectionCard>
  );
}
