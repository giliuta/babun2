"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarHeart } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  useCalendarSettings,
  useCurrentMaster,
  useMasters,
} from "@/components/layout/DashboardClientLayout";
import {
  validateCalendarSettings,
  TIMEZONE_OPTIONS,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import { usePersonalCalendarEnabled } from "@/hooks/usePersonalCalendarEnabled";
import { setPersonalCalendarEnabled } from "@/app/dashboard/settings/account/personal-calendar-action";

// v437 — Personal calendar is scoped to "an entry on a date+time with
// optional reminder". No more "Запись клиента" / "Событие" / "Push"
// sub-feature toggles in settings — the reminder/push lead-time will
// be a per-event field inside the create-event sheet itself.

// v434 — full 0-23 range for both bounds. Was 0-23 / 1-24 split which
// surprised users who expected to set the day to end at midnight.
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarSettingsPage() {
  const { calendarSettings, setCalendarSettings } = useCalendarSettings();
  const { currentMasterId } = useCurrentMaster();
  const { masters, upsertMaster } = useMasters();
  const currentMaster = masters.find((m) => m.id === currentMasterId) ?? null;
  const [draft, setDraft] = useState<CalendarSettings>({ ...calendarSettings });
  const [saved, setSaved] = useState(false);

  // Personal-calendar tenant toggle. v429 — moved here from "Личная
  // информация" so all calendar-shape settings live in one place.
  const personalCal = usePersonalCalendarEnabled();
  const [pcEnabled, setPcEnabled] = useState(true);
  const [pcError, setPcError] = useState<string | null>(null);
  const [, startPcTransition] = useTransition();
  useEffect(() => {
    if (personalCal.loaded) setPcEnabled(personalCal.enabled);
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

  const error = validateCalendarSettings(draft);

  const patch = (p: Partial<CalendarSettings>) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...p }));
  };

  const handleSave = () => {
    if (error) return;
    setCalendarSettings(draft);
    setSaved(true);
  };

  const handleReset = () => {
    setDraft({ ...calendarSettings });
    setSaved(false);
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
                  Свои встречи и заметки. Видны только тебе, не команде.
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

          {/* Time range — three compact rows: what hours appear on the
              grid, which of those count as working (highlighted), and
              the hour the calendar auto-scrolls to on open. v438. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-[15px] font-semibold text-[var(--label)]">
              Диапазон часов
            </div>

            <HoursRangeRow
              label="Видимо"
              hint="что отображается"
              from={draft.startHour}
              to={draft.endHour}
              onFromChange={(v) => patch({ startHour: v })}
              onToChange={(v) => patch({ endHour: v })}
            />
            <HoursRangeRow
              label="Рабочие"
              hint="подсвечиваются"
              from={draft.workStartHour ?? draft.startHour}
              to={draft.workEndHour ?? draft.endHour}
              onFromChange={(v) => patch({ workStartHour: v })}
              onToChange={(v) => patch({ workEndHour: v })}
            />
            <HourRow
              label="Открывать"
              hint="точка прокрутки"
              value={
                draft.scrollOpenHour ??
                draft.workStartHour ??
                draft.startHour
              }
              onChange={(v) => patch({ scrollOpenHour: v })}
            />

            {error && (
              <div className="mx-4 mb-3 text-[12px] text-[var(--system-red)] bg-[var(--system-red-tint)] rounded-[10px] px-3 py-2">
                {error}
              </div>
            )}
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
                    draft.gridStep === step
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

          {/* Week start — compact iOS segmented control */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)]">
              Начало недели
            </div>
            <div className="inline-flex p-0.5 rounded-[10px] bg-[var(--fill-tertiary)] shrink-0">
              {(["monday", "sunday"] as const).map((day) => {
                const active = draft.weekStart === day;
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

          {/* Timezone */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Часовой пояс</div>
            <select
              value={draft.timezone}
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

          {/* Save */}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" fullWidth onClick={handleReset}>
              Сбросить
            </Button>
            <Button
              variant={saved ? "primary" : "primary"}
              size="md"
              fullWidth
              disabled={!!error}
              onClick={handleSave}
              className={saved ? "!bg-[var(--system-green)]" : ""}
            >
              {saved ? "Сохранено!" : "Сохранить"}
            </Button>
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
      <div className="w-[88px] shrink-0">
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
      <div className="w-[88px] shrink-0">
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
