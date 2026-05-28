"use client";

/**
 * PhotoCard — always-visible fixed-height card for ФОТО. Shows photo count
 * or "Добавить фото" CTA. Sub-line "Сохраните запись для фото" shown in
 * create mode. Tap opens PhotoPopup (only when liveMode !== "create").
 * Always min-h-[76px].
 */

import { Camera } from "@babun/shared/icons";
import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface PhotoCardProps {
  photoCount: number;
  canUpload: boolean;
  onTap?: () => void;
}

export default function PhotoCard({
  photoCount,
  canUpload,
  onTap,
}: PhotoCardProps) {
  const value =
    photoCount > 0
      ? `${photoCount} фото`
      : "Добавить фото";

  const hint =
    !canUpload && photoCount === 0
      ? "Сохраните запись для добавления фото"
      : undefined;

  return (
    <SectionCard>
      <AppointmentRow
        label="ФОТО"
        value={hint ? undefined : value}
        hint={hint}
        accent={photoCount === 0 && canUpload}
        onTap={canUpload || photoCount > 0 ? onTap : undefined}
        showChevron={canUpload || photoCount > 0}
        rightAccessory={
          photoCount > 0 ? (
            <span className="text-[12px] font-semibold text-[var(--label-secondary)] tabular-nums">
              {photoCount} шт
            </span>
          ) : (
            <Camera size={16} strokeWidth={2} className="text-[var(--label-tertiary)]" />
          )
        }
      />
    </SectionCard>
  );
}
