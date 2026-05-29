"use client";

/**
 * ObjectCard — fixed-height card for the ОБЪЕКТ (location/address)
 * section. Always min-h-[76px]. Tap opens AddressEditorPopup via the
 * caller's handler. When no client is selected the caller calls
 * setAskClientFirst instead.
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface ObjectCardProps {
  readonly: boolean;
  locationValue: string | null;
  locationSub?: string;
  onTap?: () => void;
}

export default function ObjectCard({
  readonly,
  locationValue,
  locationSub,
  onTap,
}: ObjectCardProps) {
  return (
    <SectionCard>
      <AppointmentRow
        label="ОБЪЕКТ"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>}
        tileClass="bg-[var(--tile-indigo)]"
        value={
          locationValue ??
          (readonly ? "Не указан" : "Добавить объект")
        }
        accent={!locationValue && !readonly}
        sub={locationSub}
        onTap={readonly ? undefined : onTap}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
