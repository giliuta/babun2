"use client";

import { X } from "@babun/shared/icons";
import type { AppointmentPhotoRecord } from "@babun/shared/db/repositories/appointment-photos";
import PhotoBlock from "./PhotoBlock";

interface PhotoPopupProps {
  open: boolean;
  photos: AppointmentPhotoRecord[];
  readonly: boolean;
  tenantId: string;
  appointmentId: string;
  locationLabel?: string;
  onChange: (next: AppointmentPhotoRecord[]) => void;
  onClose: () => void;
}

// Centered popup wrapping the PhotoBlock photo grid.
// Follows popup-design rule: fixed inset-0 flex items-center justify-center,
// rounded-[20px], no grabber pill.
export default function PhotoPopup({
  open,
  photos,
  readonly,
  tenantId,
  appointmentId,
  locationLabel,
  onChange,
  onClose,
}: PhotoPopupProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
            Фото
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body — reuses PhotoBlock logic */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3">
          <PhotoBlock
            photos={photos}
            readonly={readonly}
            tenantId={tenantId}
            appointmentId={appointmentId}
            locationLabel={locationLabel}
            onChange={onChange}
            canUpload={!readonly}
          />
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
