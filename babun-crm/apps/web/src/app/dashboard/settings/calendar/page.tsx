"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarHeart, ChevronRight, MapPin, Tag } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  useCalendarSettings,
  useCurrentMaster,
  useMasters,
} from "@/components/layout/DashboardClientLayout";
import {
  TIMEZONE_OPTIONS,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import { usePersonalCalendarEnabled } from "@/hooks/usePersonalCalendarEnabled";
import { setPersonalCalendarEnabled } from "@/app/dashboard/settings/account/personal-calendar-action";

// v437 — Personal calendar is scoped to "an entry on a date+time with
// optional reminder". No more "Запись клиента" / "Событие" / "Push"
// sub-feature toggles in settings — the reminder/push lead-time will
// be a per-event field inside the create-event sheet itself.

export default function CalendarSettingsPage() {
  const { calendarSettings, setCalendarSettings } = useCalendarSettings();
  const { currentMasterId } = useCurrentMaster();
  const { masters, upsertMaster } = useMasters();
  const currentMaster = masters.find((m) => m.id === currentMasterId) ?? null;
  // v445 — auto-save. No Save button, no draft buffer; every change
  // commits immediately through the context (which writes to
  // localStorage + Supabase). A small green badge flashes for 1.5s
  // after each commit so the user gets the "saved" feedback they
  // would have got from a button label change.
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);
  const flashSaved = () => {
    setSavedFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setSavedFlash(false), 1500);
  };

  // Personal-calendar tenant toggle. v429 — moved here from "Личная
  // информация" so all calendar-shape settings live in one place.
  const personalCal = usePersonalCalendarEnabled();
  const [pcEnabled, setPcEnabled] = useState(true);
  const [pcError, setPcError] = useState<string | null>(null);
  const [, startPcTransition] = useTransition();
  useEffect(() => {
    if (personalCal.loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPcEnabled(personalCal.enabled);
    }
  }, [personalCal.loaded, personalCal.enabled]);
  const togglePersonalCal = (next: boolean) => {
    setPcError(null);
    setPcEnabled(next); // optimistic
    startPcTransition(async () => {
      const res = await setPersonalCalendarEnabled(next);
      if (!res.ok) {
        setPcError(res.error);
        setPcEnabled(!next);
      }
    });
  };

  // Personal-calendar name lives on the master record. Colour was
  // dropped from this page in v434 — when the calendar is purely a
  // personal-events surface, the team-distinguishing colour swatch is
  // noise.
  const personalName = currentMaster?.personal_calendar_name ?? "";
  const commitPersonalName = (next: string) => {
    if (!currentMaster) return;
    const trimmed = next.trim();
    if (trimmed === (currentMaster.personal_calendar_name ?? "")) return;
    upsertMaster({
      ...currentMaster,
      personal_calendar_name: trimmed || undefined,
    });
  };

  // v445 — single source of truth: the context's `calendarSettings`.
  // No local draft; every control reads from context and writes
  // through `patch` which auto-commits with cascade-clamp so a partial
  // edit can never leave the settings in an invalid state.
  const settings = calendarSettings;

  // v448 — flipped clamp direction. Was: work / scroll-open were
  // hard-clamped INSIDE the visible range, which meant if the user
  // had visible=04..24 and tried to set «Открывается = 02:00», the
  // value silently snapped back to 04. Now: when work / scroll-open
  // is set to a value OUTSIDE the visible range, the visible range
  // EXPANDS to include it. The user's mental model is "the picker
  // lets me pick any hour"; the visible range is just the outer
  // viewport and follows along.
  const patch = (p: Partial<CalendarSettings>) => {
    const next: CalendarSettings = { ...settings, ...p };

    // 1. Visible range self-validation — if user inverted start/end,
    //    push the OTHER side so the range stays ≥ 1 h wide.
    if (next.endHour <= next.startHour) {
      if ("startHour" in p) {
        next.endHour = Math.min(24, next.startHour + 1);
      } else if ("endHour" in p) {
        next.startHour = Math.max(0, next.endHour - 1);
      }
    }

    // 2. Out-of-range work / scroll-open EXPANDS the visible range,
    //    rather than getting silently clamped back. Hard bounds
    //    [0..24] still apply.
    const incomingWs = "workStartHour" in p ? p.workStartHour : undefined;
    const incomingWe = "workEndHour" in p ? p.workEndHour : undefined;
    const incomingOpen = "scrollOpenHour" in p ? p.scrollOpenHour : undefined;

    if (incomingWs !== undefined && incomingWs < next.startHour) {
      next.startHour = Math.max(0, incomingWs);
    }
    if (incomingWe !== undefined && incomingWe > next.endHour) {
      next.endHour = Math.min(24, incomingWe);
    }
    if (incomingOpen !== undefined) {
      if (incomingOpen < next.startHour) {
        next.startHour = Math.max(0, incomingOpen);
      }
      if (incomingOpen > next.endHour) {
        next.endHour = Math.min(24, incomingOpen);
      }
    }

    // 3. Final clamp — work band must sit inside the (possibly
    //    expanded) visible range. When the user shrunk visible past
    //    existing work bounds, work narrows to fit.
    let ws = next.workStartHour ?? next.startHour;
    let we = next.workEndHour ?? next.endHour;
    ws = Math.max(next.startHour, Math.min(ws, next.endHour - 1));
    we = Math.min(next.endHour, Math.max(we, next.startHour + 1));
    if (we <= ws) {
      if ("workStartHour" in p) we = Math.min(next.endHour, ws + 1);
      else ws = Math.max(next.startHour, we - 1);
    }
    next.workStartHour = ws;
    next.workEndHour = we;

    // 4. Scroll-open clamped to visible range. If the user set it
    //    explicitly, that value won (visible was already expanded
    //    above); otherwise fall back to workStart.
    const open = next.scrollOpenHour ?? ws;
    next.scrollOpenHour = Math.max(
      next.startHour,
      Math.min(open, next.endHour),
    );

    setCalendarSettings(next);
    flashSaved();
  };

  return (
    <>
      <PageHeader title="Мой календарь" backHref="/dashboard/settings" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-5 pb-24">

          {/* Personal calendar toggle + identity (name + push). v434 —
              colour picker dropped (the personal calendar is just a
              private-events surface, doesn't need to be visually
              distinguished from a team palette). */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <CalendarHeart size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Личный календарь
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Свои встречи и заметки. Видны только вам, не команде.
                </div>
              </div>
              <IOSSwitch
                checked={pcEnabled}
                onChange={togglePersonalCal}
                ariaLabel="Включить личный календарь"
              />
            </div>
            {pcError && (
              <div className="px-4 pb-3 text-[12px] text-[var(--system-red)] leading-snug">
                {pcError}
              </div>
            )}

            {pcEnabled && currentMaster && (
              <>
                <div className="px-4 pb-4 pt-1 border-t border-[var(--separator)]">
                  <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                    Название
                  </label>
                  <input
                    type="text"
                    defaultValue={personalName || "Мой календарь"}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      commitPersonalName(v === "Мой календарь" ? "" : v);
                    }}
                    maxLength={40}
                    className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                  />
                </div>
              </>
            )}
          </div>

          {/* v436 — everything below only renders when the personal
              calendar is on. Off → just the toggle card. */}
          {pcEnabled && (
            <>

          {/* Time range — v441 wording. The personal calendar is a
              personal-events surface, not a work shift, so "Рабочие /
              Работаю" terminology was wrong. New labels describe each
              row by its function in plain language: what's on the
              grid, when events are planned, where the calendar lands
              on open. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-[15px] font-semibold text-[var(--label)]">
              Часы дня
            </div>

            <HoursRangeRow
              label="Видимое время"
              from={settings.startHour}
              to={settings.endHour}
              onFromChange={(v) => patch({ startHour: v })}
              onToChange={(v) => patch({ endHour: v })}
            />
            <HoursRangeRow
              label="Рабочее время"
              from={settings.workStartHour ?? settings.startHour}
              to={settings.workEndHour ?? settings.endHour}
              onFromChange={(v) => patch({ workStartHour: v })}
              onToChange={(v) => patch({ workEndHour: v })}
            />
            <HourRow
              label="Открывается время"
              value={
                settings.scrollOpenHour ??
                settings.workStartHour ??
                settings.startHour
              }
              onChange={(v) => patch({ scrollOpenHour: v })}
            />
          </div>

          {/* Grid step */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Шаг сетки</div>
            <div className="flex gap-2">
              {([15, 30, 60] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => patch({ gridStep: step })}
                  className={`flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-all ${
                    settings.gridStep === step
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                  }`}
                >
                  {step} мин
                </button>
              ))}
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
              На сколько минут разделена каждая часовая ячейка. 30 мин —
              самый частый выбор: запись минимум на полчаса. 15 мин —
              если бывают короткие визиты, 60 мин — для длинных смен.
            </div>
          </div>

          {/* STORY-060 §F2.5 — Выходные дни.
              7 чипов (Пн..Вс). Тап переключает день в массиве
              settings.days_off. JS weekday: Sun=0..Sat=6 — мы
              показываем по-человечески слева-направо начиная с Пн. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">
              Выходные дни
            </div>
            <div className="flex gap-1.5">
              {(
                [
                  { label: "Пн", weekday: 1 },
                  { label: "Вт", weekday: 2 },
                  { label: "Ср", weekday: 3 },
                  { label: "Чт", weekday: 4 },
                  { label: "Пт", weekday: 5 },
                  { label: "Сб", weekday: 6 },
                  { label: "Вс", weekday: 0 },
                ] as const
              ).map(({ label, weekday }) => {
                const isOff = settings.days_off.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={isOff}
                    onClick={() => {
                      const set = new Set<number>(settings.days_off);
                      if (set.has(weekday)) set.delete(weekday);
                      else set.add(weekday);
                      const nextDays = Array.from(set).sort((a, b) => a - b);
                      patch({ days_off: nextDays });
                    }}
                    className={`flex-1 h-10 rounded-[10px] text-[13px] font-semibold transition-all ${
                      isOff
                        ? "bg-[var(--system-red)] text-white"
                        : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
              В эти дни заголовок будет красным, а сетка приглушённой.
            </div>
          </div>

          {/* Week start — compact iOS segmented control */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)]">
              Начало недели
            </div>
            <div className="inline-flex p-0.5 rounded-[10px] bg-[var(--fill-tertiary)] shrink-0">
              {(["monday", "sunday"] as const).map((day) => {
                const active = settings.weekStart === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => patch({ weekStart: day })}
                    className={`h-8 px-3 rounded-[8px] text-[13px] font-medium transition-all ${
                      active
                        ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        : "text-[var(--label-secondary)]"
                    }`}
                  >
                    {day === "monday" ? "Пн" : "Вс"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event types — links to the CRUD page where the user
              configures the tile grid in PersonalEventSheet. */}
          <Link
            href="/dashboard/settings/calendar/event-types"
            className="block bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)] transition"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Tag size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Шаблоны быстрого применения
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Чипы над названием события: Обед, Встреча, Выходной…
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} className="text-[var(--label-tertiary)] shrink-0" />
            </div>
          </Link>

          {/* v492 — personal-calendar labels: dedicated page with the
              same swipe / star / edit / delete UX as brigade labels.
              Writes to CalendarSettings.personalLabels — separate
              namespace from per-brigade `team.cities`, but pulls
              suggestions from labels you've already used elsewhere. */}
          <Link
            href="/dashboard/settings/calendar/labels"
            className="block bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)] transition"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <MapPin size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Метки
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Город / тег под датой. Свайп → основной / удалить.
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} className="text-[var(--label-tertiary)] shrink-0" />
            </div>
          </Link>

          {/* Timezone */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Часовой пояс</div>
            <select
              value={settings.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* v446 — Reset button removed (юзер: «там и так мало
              настроек»). Auto-save badge stays as the only feedback
              chrome — centred below the last card and fades in/out
              for 1.5 s after each commit. */}
          <div
            className={`text-center text-[13px] font-medium text-[var(--system-green)] transition-opacity duration-300 ${
              savedFlash ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            ✓ Сохранено
          </div>

            </>
          )}
          {/* end of pcEnabled gate */}

        </div>
      </div>
    </>
  );
}

// HoursRangeRow — one tabular row inside "Диапазон часов" with two
// hour pickers separated by a dash. Used for the visible-grid range
// and the working-hours range.
function HoursRangeRow({
  label,
  hint,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  label: string;
  hint?: string;
  from: number;
  to: number;
  onFromChange: (v: number) => void;
  onToChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
      <div className="w-[140px] shrink-0">
        <div className="text-[14px] text-[var(--label)]">{label}</div>
        {hint && (
          <div className="text-[11px] text-[var(--label-tertiary)] leading-tight mt-0.5">
            {hint}
          </div>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <HourSelect value={from} onChange={onFromChange} />
        <span className="text-[var(--label-tertiary)] text-[14px]">—</span>
        <HourSelect value={to} onChange={onToChange} includeMidnightEnd />
      </div>
    </div>
  );
}

// HourRow — single hour picker. Used for "Открывать" (scroll target).
function HourRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
      <div className="w-[140px] shrink-0">
        <div className="text-[14px] text-[var(--label)]">{label}</div>
        {hint && (
          <div className="text-[11px] text-[var(--label-tertiary)] leading-tight mt-0.5">
            {hint}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <HourSelect value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function HourSelect({
  value,
  onChange,
  // includeMidnightEnd lets a "to" picker offer 24:00 as an option,
  // representing midnight at end-of-day. Default false (start picker /
  // single-hour picker = 00..23 only).
  includeMidnightEnd = false,
}: {
  value: number;
  onChange: (v: number) => void;
  includeMidnightEnd?: boolean;
}) {
  const length = includeMidnightEnd ? 25 : 24;
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[8px] text-[14px] text-[var(--label)] tabular-nums focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
    >
      {Array.from({ length }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

// Brief 1 #17 — Visual 24-hour timeline of the three ranges so the
// operator sees how «Видимое» / «Рабочее» / «Открывается» relate at
// a glance instead of reconstructing three numbers in their head.
// Read-only; the rows above are the source of truth.
function RangeTimeline({
  visibleStart,
  visibleEnd,
  workStart,
  workEnd,
  opensAt,
}: {
  visibleStart: number;
  visibleEnd: number;
  workStart: number;
  workEnd: number;
  opensAt: number;
}) {
  const W = 100;
  const H = 36;
  const pad = 2;
  const usable = W - pad * 2;
  const x = (h: number) => pad + (usable * Math.max(0, Math.min(24, h))) / 24;
  return (
    <div className="px-4 pt-1 pb-4 border-t border-[var(--separator)]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-9"
        role="img"
        aria-label={`Видимое ${visibleStart}–${visibleEnd}, рабочее ${workStart}–${workEnd}, открывается в ${opensAt}`}
      >
        {[0, 6, 12, 18, 24].map((h) => (
          <line
            key={h}
            x1={x(h)}
            x2={x(h)}
            y1={4}
            y2={H - 8}
            stroke="var(--separator-opaque)"
            strokeWidth={0.3}
          />
        ))}
        <rect
          x={x(visibleStart)}
          y={6}
          width={Math.max(0, x(visibleEnd) - x(visibleStart))}
          height={H - 16}
          rx={2}
          fill="var(--fill-secondary)"
        />
        <rect
          x={x(workStart)}
          y={10}
          width={Math.max(0, x(workEnd) - x(workStart))}
          height={H - 24}
          rx={2}
          fill="var(--accent)"
          opacity={0.85}
        />
        <line
          x1={x(opensAt)}
          x2={x(opensAt)}
          y1={2}
          y2={H - 6}
          stroke="var(--system-orange)"
          strokeWidth={0.5}
        />
        <circle
          cx={x(opensAt)}
          cy={H - 6}
          r={1.4}
          fill="var(--system-orange)"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--label-tertiary)] tabular-nums px-[2px] mt-1">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[var(--label-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-[var(--fill-secondary)]" />
          Видимое
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-[var(--accent)] opacity-85" />
          Рабочее
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-[2px] h-3 bg-[var(--system-orange)]" />
          Открывается
        </span>
      </div>
    </div>
  );
}
