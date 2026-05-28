"use client";

/**
 * ClientCard — fixed-height card for the КЛИЕНТ section of the
 * appointment form. Renders client name / phone / stats or the
 * "Выбрать клиента" empty-state CTA. Always min-h-[76px].
 *
 * When `client` is set, renders a phone-call link and (when editable)
 * a three-dot menu button as the right accessory.
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface ClientCardProps {
  readonly: boolean;
  clientName: string | null;
  clientPhone: string | null;
  clientSub?: string;
  onTap?: () => void;
  onMenuOpen?: () => void;
}

export default function ClientCard({
  readonly,
  clientName,
  clientPhone,
  clientSub,
  onTap,
  onMenuOpen,
}: ClientCardProps) {
  const hasClient = Boolean(clientName);

  const rightAccessory = hasClient ? (
    <div className="flex items-center gap-0.5">
      {clientPhone && (
        <a
          href={`tel:${clientPhone.replace(/\D/g, "")}`}
          aria-label="Позвонить"
          onClick={(e) => e.stopPropagation()}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </a>
      )}
      {!readonly && onMenuOpen && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(); }}
          aria-label="Меню клиента"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <SectionCard>
      <AppointmentRow
        label="КЛИЕНТ"
        value={clientName ?? "Выбрать клиента"}
        accent={!clientName}
        sub={clientSub}
        onTap={readonly ? undefined : onTap}
        showChevron={!hasClient && !readonly}
        rightAccessory={rightAccessory}
      />
    </SectionCard>
  );
}
