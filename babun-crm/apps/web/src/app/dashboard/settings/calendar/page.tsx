"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, CalendarHeart, Sparkles, UserPlus } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  useCalendarSettings,
  useCurrentMaster,
  useFormSettings,
  useMasters,
} from "@/components/layout/DashboardClientLayout";
import {
  validateCalendarSettings,
  TIMEZONE_OPTIONS,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import { usePersonalCalendarEnabled } from "@/hooks/usePersonalCalendarEnabled";
import { setPersonalCalendarEnabled } from "@/app/dashboard/settings/account/personal-calendar-action";

// LocalStorage keys for the per-personal-calendar feature flags
// (v436). The actual booking-form / event-form schemas the UI
// produces will be wired into AppointmentSheet in a follow-up; for
// now this page just remembers which sub-features the owner enabled.
const APPT_ENABLED_KEY = "babun:personal-cal:appointments-on";
const EVENT_ENABLED_KEY = "babun:personal-cal:events-on";
const EVENT_DEFAULT_DURATION_KEY = "babun:personal-cal:event-default-duration";
const EVENT_REMINDER_KEY = "babun:personal-cal:event-reminder-min";

// v434 — full 0-23 range for both bounds. Was 0-23 / 1-24 split which
// surprised users who expected to set the day to end at midnight.
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);

// LocalStorage key for the personal-calendar push toggle. Real push
// subscription wiring happens in a later pass; this flag is just the
// preference signal.
const PERSONAL_PUSH_KEY = "babun:personal-calendar-push";

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

  // Push notifications for personal-calendar events. Stored client-side
  // for now; the real Web Push subscription is hooked up in a later
  // pass. The preference itself persists across reloads.
  const [pushEnabled, setPushEnabled] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPushEnabled(
        typeof window !== "undefined" &&
          window.localStorage.getItem(PERSONAL_PUSH_KEY) === "1",
      );
    } catch {
      /* private mode */
    }
  }, []);
  const togglePush = (next: boolean) => {
    setPushEnabled(next);
    try {
      window.localStorage.setItem(PERSONAL_PUSH_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // v436 — Two sub-features the owner can opt into for the personal
  // calendar:
  //   • Appointments ("Запись клиента") — same fields as a brigade
  //     visit. Field visibility / required reuses the existing global
  //     useFormSettings() store; the toggle just exposes the form.
  //   • Events ("Событие") — owner-only personal event with a default
  //     duration + reminder lead-time. Stored locally for now.
  const { fieldVisibility, setFieldVisibility, requiredFields, setRequiredFields } =
    useFormSettings();

  const [apptEnabled, setApptEnabled] = useState(false);
  const [eventEnabled, setEventEnabled] = useState(false);
  const [eventDuration, setEventDuration] = useState<15 | 30 | 60>(30);
  const [eventReminder, setEventReminder] = useState<0 | 5 | 15 | 30 | 60>(15);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApptEnabled(window.localStorage.getItem(APPT_ENABLED_KEY) === "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventEnabled(window.localStorage.getItem(EVENT_ENABLED_KEY) === "1");
      const d = parseInt(window.localStorage.getItem(EVENT_DEFAULT_DURATION_KEY) ?? "30", 10);
      if ([15, 30, 60].includes(d)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEventDuration(d as 15 | 30 | 60);
      }
      const r = parseInt(window.localStorage.getItem(EVENT_REMINDER_KEY) ?? "15", 10);
      if ([0, 5, 15, 30, 60].includes(r)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEventReminder(r as 0 | 5 | 15 | 30 | 60);
      }
    } catch {
      /* private mode */
    }
  }, []);
  const writeFlag = (key: string, on: boolean) => {
    try {
      window.localStorage.setItem(key, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const writeNum = (key: string, n: number) => {
    try {
      window.localStorage.setItem(key, String(n));
    } catch {
      /* ignore */
    }
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
                  <div className="text-[11px] text-[var(--label-tertiary)] mt-1">
                    Тапни и набери своё — старое выделится автоматически.
                  </div>
                </div>

                {/* Push notifications */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
                  <div className="w-9 h-9 rounded-[10px] bg-[var(--system-orange-tint,rgba(255,149,0,0.12))] text-[var(--system-orange,#FF9500)] flex items-center justify-center shrink-0">
                    <Bell size={16} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] text-[var(--label)]">
                      Push-уведомления
                    </div>
                    <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                      Напомнит о ближайшем событии за 15 минут.
                    </div>
                  </div>
                  <IOSSwitch
                    checked={pushEnabled}
                    onChange={togglePush}
                    ariaLabel="Push-уведомления для личного календаря"
                  />
                </div>
              </>
            )}
          </div>

          {/* v436 — everything below this point only renders when the
              personal calendar is on. Off → just the toggle card. */}
          {pcEnabled && (
            <>

          {/* "Запись клиента" — collapsible. On = appointments form
              available in the personal calendar; expanded body shows
              field-visibility / required toggles (reuses the global
              form-settings store for now). */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <UserPlus size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Запись клиента
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Можно записать клиента прямо в личный календарь.
                </div>
              </div>
              <IOSSwitch
                checked={apptEnabled}
                onChange={(next) => {
                  setApptEnabled(next);
                  writeFlag(APPT_ENABLED_KEY, next);
                }}
                ariaLabel="Включить запись клиента"
              />
            </div>

            {apptEnabled && (
              <div className="border-t border-[var(--separator)]">
                <div className="px-4 py-3">
                  <div className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                    Поля формы
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] leading-snug mt-1">
                    Какие поля показывать при создании записи.
                  </div>
                </div>
                <FieldRow
                  label="Адрес"
                  checked={fieldVisibility.show_address}
                  onChange={(v) =>
                    setFieldVisibility({ ...fieldVisibility, show_address: v })
                  }
                />
                <FieldRow
                  label="Комментарий"
                  checked={fieldVisibility.show_comment}
                  onChange={(v) =>
                    setFieldVisibility({ ...fieldVisibility, show_comment: v })
                  }
                />
                <FieldRow
                  label="Аванс / предоплата"
                  checked={fieldVisibility.show_prepaid}
                  onChange={(v) =>
                    setFieldVisibility({ ...fieldVisibility, show_prepaid: v })
                  }
                />
                <FieldRow
                  label="Способы оплаты"
                  checked={fieldVisibility.show_payments}
                  onChange={(v) =>
                    setFieldVisibility({ ...fieldVisibility, show_payments: v })
                  }
                />

                <div className="px-4 py-3 border-t border-[var(--separator)]">
                  <div className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                    Обязательно
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] leading-snug mt-1">
                    Без них запись нельзя сохранить.
                  </div>
                </div>
                <FieldRow
                  label="Клиент"
                  checked={requiredFields.require_client}
                  onChange={(v) =>
                    setRequiredFields({ ...requiredFields, require_client: v })
                  }
                />
                <FieldRow
                  label="Телефон клиента"
                  checked={requiredFields.require_phone}
                  onChange={(v) =>
                    setRequiredFields({ ...requiredFields, require_phone: v })
                  }
                />
                <FieldRow
                  label="Услуги"
                  checked={requiredFields.require_services}
                  onChange={(v) =>
                    setRequiredFields({ ...requiredFields, require_services: v })
                  }
                />
                <FieldRow
                  label="Адрес"
                  checked={requiredFields.require_address}
                  onChange={(v) =>
                    setRequiredFields({ ...requiredFields, require_address: v })
                  }
                />
              </div>
            )}
          </div>

          {/* "Событие" — собственное событие (без клиента). Длительность
              по умолчанию + время напоминания. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Событие
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                  Личные встречи и заметки без клиента.
                </div>
              </div>
              <IOSSwitch
                checked={eventEnabled}
                onChange={(next) => {
                  setEventEnabled(next);
                  writeFlag(EVENT_ENABLED_KEY, next);
                }}
                ariaLabel="Включить события"
              />
            </div>

            {eventEnabled && (
              <div className="border-t border-[var(--separator)] px-4 py-4 space-y-4">
                <div>
                  <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                    Длительность по умолчанию
                  </div>
                  <div className="flex gap-2">
                    {([15, 30, 60] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setEventDuration(d);
                          writeNum(EVENT_DEFAULT_DURATION_KEY, d);
                        }}
                        className={`flex-1 h-10 rounded-[10px] text-[13px] font-medium transition-colors ${
                          eventDuration === d
                            ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                            : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                        }`}
                      >
                        {d} мин
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                    Напоминание
                  </div>
                  <div className="flex gap-1.5">
                    {([0, 5, 15, 30, 60] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setEventReminder(m);
                          writeNum(EVENT_REMINDER_KEY, m);
                        }}
                        className={`flex-1 h-9 rounded-[10px] text-[12px] font-medium transition-colors ${
                          eventReminder === m
                            ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                            : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                        }`}
                      >
                        {m === 0 ? "нет" : `${m}м`}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] leading-snug mt-2">
                    За сколько до события показать push-уведомление.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-4">
            <div className="text-[15px] font-semibold text-[var(--label)]">Диапазон часов</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Начало дня
                </label>
                <select
                  value={draft.startHour}
                  onChange={(e) => patch({ startHour: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                >
                  {HOURS_0_23.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Конец дня
                </label>
                <select
                  value={draft.endHour}
                  onChange={(e) => patch({ endHour: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                >
                  {HOURS_0_23.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-[var(--system-red)] bg-[var(--system-red-tint)] rounded-[10px] px-3 py-2">
                {error}
              </div>
            )}

            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
              Календарь открывается и при возврате прокручивается
              к {String(draft.startHour).padStart(2, "0")}:00 — это твоё рабочее
              начало дня.
            </div>
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

// FieldRow — small switch row reused inside the "Запись клиента"
// expanded body. Kept local to this page; can graduate to a shared
// component if a second screen needs the same shape.
function FieldRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
      <div className="flex-1 min-w-0 text-[15px] text-[var(--label)]">{label}</div>
      <IOSSwitch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}
