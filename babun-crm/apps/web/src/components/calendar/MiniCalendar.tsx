"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "@babun/shared/icons";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthName,
  isSameDay,
  getMonday,
  formatDateKey,
} from "@babun/shared/common/utils/date-utils";
import { haptic } from "@/lib/haptics";

/** v554 — MiniCalendar accepts a *narrow* view of the appointment row.
 *  Only the fields the date-picker actually renders are typed: date for
 *  the dot, status for the tooltip aggregate ("3 записи: 2 выполнено,
 *  1 запланирована"), and time_start/comment/kind for the long-press
 *  preview rows. Everything is optional so legacy callers that pass
 *  just `{ date }` keep compiling. */
interface MiniCalendarAppointment {
  date: string;
  time_start?: string;
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  kind?: "work" | "event" | "personal";
  comment?: string;
}

interface MiniCalendarProps {
  currentDate: Date;
  appointments: MiniCalendarAppointment[];
  onSelectDate: (monday: Date) => void;
  onClose: () => void;
}

// ─── Russian plural helper ────────────────────────────────────────
// 1 запись, 2-4 записи, 5+ записей. Used in the title-attr tooltip
// so the hover text reads natural Russian for any count.
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const MONTH_NAMES_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const DAY_NAMES = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];

function formatPreviewTitle(d: Date): string {
  const dow = DAY_NAMES[d.getDay()];
  return `${dow}, ${d.getDate()} ${MONTH_NAMES_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Build the tooltip string for one day cell.
 *  - Cancelled appointments excluded (mirrors the default-exclude
 *    convention agreed with the shared `getAppointmentsByDate` helper).
 *  - Wording branches: scheduled-only, completed-only, mixed. */
function buildDayTooltip(items: MiniCalendarAppointment[]): string {
  // Only non-cancelled count toward the dot summary.
  const live = items.filter((a) => a.status !== "cancelled");
  if (live.length === 0) return "";

  const scheduled = live.filter(
    (a) => !a.status || a.status === "scheduled" || a.status === "in_progress",
  ).length;
  const completed = live.filter((a) => a.status === "completed").length;

  if (completed === 0 && scheduled > 0) {
    return `${scheduled} ${pluralRu(scheduled, "запланирована", "запланированы", "запланировано")}`;
  }
  if (scheduled === 0 && completed > 0) {
    return `${completed} ${pluralRu(completed, "выполнена", "выполнены", "выполнено")}`;
  }
  const total = live.length;
  const recWord = pluralRu(total, "запись", "записи", "записей");
  return `${total} ${recWord}: ${completed} ${pluralRu(completed, "выполнена", "выполнены", "выполнено")}, ${scheduled} ${pluralRu(scheduled, "запланирована", "запланированы", "запланировано")}`;
}

const STATUS_BADGE: Record<
  NonNullable<MiniCalendarAppointment["status"]>,
  { label: string; cls: string }
> = {
  scheduled: {
    label: "План",
    cls: "bg-[var(--accent-tint)] text-[var(--accent)]",
  },
  in_progress: {
    label: "В работе",
    cls: "bg-[var(--system-green)] text-[var(--label-on-accent)]",
  },
  completed: {
    label: "Готово",
    cls: "bg-[var(--fill-secondary)] text-[var(--label-secondary)]",
  },
  cancelled: {
    label: "Отмена",
    cls: "bg-[var(--system-red)] text-[var(--label-on-accent)]",
  },
};

export default function MiniCalendar({
  currentDate,
  appointments,
  onSelectDate,
  onClose,
}: MiniCalendarProps) {
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
  // Brief #6: tap year → grid of years (current ± 6) so the user can
  // jump multiple years in one click instead of pressing the chevron
  // 24 times. Closes when a year is picked.
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // STORY-060 §F3.2 — long-press preview state. `previewKey` holds the
  // YYYY-MM-DD of the currently-opened preview; null when nothing is
  // open. The preview anchors near the day cell that was held.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Long-press machinery — refs only so re-renders don't reset timers.
  // `pressTimer` fires at 500 ms; `longPressFired` flags that the
  // day-click handler should be suppressed (timer won).
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const cancelPress = useCallback(() => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewKey(null);
    setPreviewAnchor(null);
  }, []);

  const today = new Date();

  // Outside click + escape + scroll close the whole picker (or just
  // the preview if it's the one open). v554 — `mousedown` is too
  // narrow for the preview-dismissal contract (touch / pointer events
  // also need to close it), so the listener was upgraded to
  // `pointerdown` which covers all input types.
  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (previewKey) {
          // First close the preview, keep the picker open.
          closePreview();
        } else {
          onClose();
        }
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previewKey) closePreview();
        else onClose();
      }
    }
    function handleScroll() {
      if (previewKey) closePreview();
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose, previewKey, closePreview]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  // Convert Sunday=0 to Monday-first: Mon=0 ... Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Group appointments by date — used for the dot count, the tooltip
  // aggregate, and the long-press preview list. Memoized so the
  // expensive bucketing only runs when the source array changes.
  const aptByDate = useMemo(() => {
    const map = new Map<string, MiniCalendarAppointment[]>();
    for (const apt of appointments) {
      const list = map.get(apt.date);
      if (list) list.push(apt);
      else map.set(apt.date, [apt]);
    }
    return map;
  }, [appointments]);

  const handleDayClick = (day: number) => {
    // Long-press already fired and opened the preview — swallow click.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    const selected = new Date(viewYear, viewMonth, day);
    const monday = getMonday(selected);
    onSelectDate(monday);
    onClose();
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    dateKey: string,
    hasApts: boolean,
  ) => {
    // Skip mouse — desktop already gets the title-attr tooltip.
    if (e.pointerType !== "touch" || !hasApts) return;
    longPressFired.current = false;
    cancelPress();
    const target = e.currentTarget;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      // Anchor the preview relative to the picker root.
      const root = ref.current;
      const cell = target.getBoundingClientRect();
      if (root) {
        const rootRect = root.getBoundingClientRect();
        // Below the cell by default; clamp so the 280-px card fits.
        const maxLeft = rootRect.width - 240;
        const rawLeft = cell.left - rootRect.left - 60;
        const left = Math.max(8, Math.min(maxLeft, rawLeft));
        const top = cell.bottom - rootRect.top + 6;
        setPreviewAnchor({ top, left });
      } else {
        setPreviewAnchor({ top: 0, left: 0 });
      }
      setPreviewKey(dateKey);
      haptic("select");
    }, 500);
  };

  const handlePointerEnd = () => {
    cancelPress();
  };

  const dayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const previewItems = previewKey ? aptByDate.get(previewKey) ?? [] : [];
  const previewLive = previewItems.filter((a) => a.status !== "cancelled");
  // Sort by time_start so the preview reads chronologically.
  const previewSorted = [...previewLive].sort((a, b) =>
    (a.time_start ?? "").localeCompare(b.time_start ?? ""),
  );
  const previewVisible = previewSorted.slice(0, 5);
  const previewOverflow = previewSorted.length - previewVisible.length;
  const previewDate = previewKey
    ? new Date(
        Number(previewKey.slice(0, 4)),
        Number(previewKey.slice(5, 7)) - 1,
        Number(previewKey.slice(8, 10)),
      )
    : null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-2 bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] border border-[var(--separator)] p-3 z-50 w-[288px]"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--fill-quaternary)] text-[var(--label-secondary)] transition"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => setYearPickerOpen((prev) => !prev)}
          aria-label="Выбрать год"
          aria-expanded={yearPickerOpen}
          className="text-[15px] font-semibold text-[var(--label)] capitalize tracking-tight px-2 py-0.5 rounded-md active:bg-[var(--fill-quaternary)] transition"
        >
          {getMonthName(viewMonth)} {viewYear}
        </button>
        <button
          onClick={nextMonth}
          aria-label="Следующий месяц"
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[var(--fill-quaternary)] text-[var(--label-secondary)] transition"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      {yearPickerOpen ? (
        <div className="grid grid-cols-3 gap-1 mb-1">
          {Array.from({ length: 13 }, (_, i) => today.getFullYear() - 6 + i).map(
            (y) => {
              const active = y === viewYear;
              const isCurrent = y === today.getFullYear();
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setYearPickerOpen(false);
                  }}
                  className={`h-10 rounded-lg text-[13px] font-semibold transition active:bg-[var(--fill-quaternary)] ${
                    active
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : isCurrent
                      ? "text-[var(--accent)] border border-[var(--accent)]"
                      : "text-[var(--label)] bg-[var(--fill-tertiary)]"
                  }`}
                >
                  {y}
                </button>
              );
            },
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-0 mb-1">
            {dayHeaders.map((d) => (
              <div
                key={d}
                className="text-center text-[12px] font-semibold uppercase text-[var(--label-tertiary)] tracking-wider py-1"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(viewYear, viewMonth, day);
              const isToday = isSameDay(date, today);
              const dateKey = formatDateKey(date);
              const dayApts = aptByDate.get(dateKey) ?? [];
              const liveApts = dayApts.filter(
                (a) => a.status !== "cancelled",
              );
              const aptCount = liveApts.length;
              const tooltip = aptCount > 0 ? buildDayTooltip(dayApts) : "";

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  onPointerDown={(e) =>
                    handlePointerDown(e, dateKey, aptCount > 0)
                  }
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onPointerLeave={handlePointerEnd}
                  title={tooltip || undefined}
                  className={`h-9 flex flex-col items-center justify-center rounded-full text-[14px] relative active:bg-[var(--fill-quaternary)] transition-colors ${
                    isToday
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)] font-semibold"
                      : "text-[var(--label)]"
                  }`}
                >
                  <span className="leading-none">{day}</span>
                  {aptCount > 0 && (
                    <span
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isToday ? "bg-white/80" : "bg-[var(--accent)]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Brief #6: «Сегодня» button — jumps the view to the current
          month/year and selects today's Monday so the dispatcher
          doesn't have to chevron-back N months to «вернуться к
          сегодня». Disabled when already viewing today's month. */}
      <button
        type="button"
        onClick={() => {
          setViewYear(today.getFullYear());
          setViewMonth(today.getMonth());
          setYearPickerOpen(false);
          onSelectDate(getMonday(today));
          onClose();
        }}
        className="mt-2 w-full h-9 rounded-lg text-[13px] font-semibold text-[var(--accent)] bg-[var(--accent-tint)] active:opacity-80 transition"
      >
        Сегодня
      </button>

      {/* STORY-060 §F3.2 — long-press preview card. Touch-only;
          desktop hover relies on the title-attr tooltip above.
          Renders absolutely positioned inside the picker root so
          it inherits the outside-click / Esc / scroll close
          listeners already wired on the root. */}
      {previewKey && previewAnchor && previewDate && (
        <div
          role="dialog"
          aria-label={`Записи на ${formatPreviewTitle(previewDate)}`}
          className="absolute z-[60] w-[260px] max-h-[60vh] overflow-y-auto bg-[var(--surface-card)] rounded-[14px] border border-[var(--separator)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          style={{ top: previewAnchor.top, left: previewAnchor.left }}
        >
          <div className="text-[13px] font-medium text-[var(--label)] mb-2">
            {formatPreviewTitle(previewDate)}
          </div>
          <div className="flex flex-col gap-1.5">
            {previewVisible.map((apt, idx) => {
              const time = apt.time_start ?? "—";
              const title =
                apt.comment?.trim() ||
                (apt.kind === "event" || apt.kind === "personal"
                  ? "Личное событие"
                  : "Без названия");
              const badge = apt.status ? STATUS_BADGE[apt.status] : null;
              return (
                <div
                  key={`${apt.date}-${idx}`}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span className="text-[12px] font-semibold text-[var(--label-secondary)] tabular-nums shrink-0 w-[40px]">
                    {time}
                  </span>
                  <span className="text-[13px] text-[var(--label)] truncate flex-1">
                    {title}
                  </span>
                  {badge && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              );
            })}
            {previewOverflow > 0 && (
              <div className="text-[12px] text-[var(--label-tertiary)] pt-1">
                и ещё {previewOverflow}…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
