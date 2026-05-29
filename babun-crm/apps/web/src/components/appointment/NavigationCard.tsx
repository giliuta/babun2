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
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>}
        tileClass="bg-[var(--tile-teal)]"
        value={hasAddress ? "Открыть в Maps" : "Адрес не указан"}
        accent={hasAddress}
        onTap={hasAddress ? onTap : undefined}
        showChevron={hasAddress}
      />
    </SectionCard>
  );
}
