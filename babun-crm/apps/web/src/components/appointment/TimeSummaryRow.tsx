"use client";

/**
 * TimeSummaryRow — the compact block-2 row shared by «Клиент» and
 * «Событие»: a clock icon + «{дата} · {начало}–{конец}» (or «весь
 * день») that opens UnifiedTimePopup on tap, plus an optional «весь
 * день» toggle on the right. Purely presentational; the parent owns
 * the popup open-state and the date/time/allDay values.
 */

import { CalendarClock } from "@babun/shared/icons";
import { IOSSwitch } from "@/components/ui";
import { formatDateRu } from "@/lib/time-block-utils";

interface TimeSummaryRowProps {
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
  showAllDay: boolean;
  readonly: boolean;
  onOpen: () => void;
  onAllDayChange: (next: boolean) => void;
  /** Drop the px-4/pt-2 wrapper when the parent already pads (EventForm
   *  body). Default false — AppointmentSheet self-pads like ClientBlock. */
  noPadding?: boolean;
}

export default function TimeSummaryRow({
  dateKey,
  timeStart,
  timeEnd,
  allDay,
  showAllDay,
  readonly,
  onOpen,
  onAllDayChange,
  noPadding = false,
}: TimeSummaryRowProps) {
  return (
    <div className={noPadding ? "" : "px-4 pt-2"}>
      <div className="flex items-center gap-2 px-3 h-12 rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)]">
        <button
          type="button"
          onClick={readonly ? undefined : onOpen}
          disabled={readonly}
          className="flex-1 min-w-0 flex items-center gap-2 text-left active:opacity-70 disabled:active:opacity-100"
          aria-label="Дата и время — открыть выбор"
        >
          <span className="flex-shrink-0 text-[var(--label-tertiary)]">
            <CalendarClock size={18} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-semibold text-[var(--label)] tabular-nums truncate">
            {formatDateRu(dateKey)}
            {allDay ? (
              <span className="text-[var(--label-secondary)] font-medium"> · весь день</span>
            ) : (
              <span className="text-[var(--label-secondary)] font-medium">
                {" · "}
                {timeStart}–{timeEnd}
              </span>
            )}
          </span>
        </button>

        {showAllDay && !readonly && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              Весь день
            </span>
            <IOSSwitch
              checked={allDay}
              onChange={onAllDayChange}
              ariaLabel="Весь день"
            />
          </div>
        )}
      </div>
    </div>
  );
}
