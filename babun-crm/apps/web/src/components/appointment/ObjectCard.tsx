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
