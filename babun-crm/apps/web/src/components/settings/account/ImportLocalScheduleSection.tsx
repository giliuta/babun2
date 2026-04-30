"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Archive,
  Check,
  AlertTriangle,
} from "@babun/shared/icons";
import { loadSchedules } from "@babun/shared/local/schedule";
import { loadCalendarSettings } from "@babun/shared/local/calendar-settings";
import { loadDayCities } from "@babun/shared/local/day-cities";
import { loadDayExtras } from "@babun/shared/local/day-extras";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// STORY-044 G6 — atomic per-tenant import of the four
// schedule-related localStorage keys into Supabase via the
// public.import_schedule(p_schedules, p_calendar_settings,
// p_day_cities, p_day_extras) RPC. The function body is a single
// Postgres transaction (decision A8) — if any payload fails, all
// four entities roll back, and the live local keys are left intact
// for retry.
//
// Backup pattern matches STORY-042 G6: on success, each live key is
// renamed to `babun:<entity>:backup-<YYYY-MM-DD>` for 30 days.
// Auto-prune scan runs on every section mount.

const LIVE_KEYS = {
  schedule: "babun-team-schedules",
  calendar: "babun2:settings:calendar",
  dayCities: "babun-day-cities",
  dayExtras: "babun-day-extras",
} as const;

const BACKUP_PREFIXES = {
  schedule: "babun:schedule:backup-",
  calendar: "babun:calendar-settings:backup-",
  dayCities: "babun:day-cities:backup-",
  dayExtras: "babun:day-extras:backup-",
} as const;

const BACKUP_TTL_DAYS = 30;

interface BackupInfo {
  key: string;
  date: string;
  entity: string;
}

function readBackups(): BackupInfo[] {
  if (typeof window === "undefined") return [];
  const out: BackupInfo[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    for (const [entity, prefix] of Object.entries(BACKUP_PREFIXES)) {
      if (k.startsWith(prefix)) {
        out.push({ key: k, date: k.slice(prefix.length), entity });
        break;
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(from: string, to: Date): number {
  const f = new Date(from + "T00:00:00Z").getTime();
  const t = to.getTime();
  return Math.floor((t - f) / 86400000);
}

interface Counts {
  schedule: number;
  calendar: number;
  dayCities: number;
  dayExtras: number;
}

function readLiveCounts(): Counts {
  return {
    schedule: Object.keys(loadSchedules()).length,
    calendar: typeof window !== "undefined" && window.localStorage.getItem(LIVE_KEYS.calendar) ? 1 : 0,
    dayCities: Object.keys(loadDayCities()).length,
    dayExtras: Object.values(loadDayExtras()).reduce((s, arr) => s + arr.length, 0),
  };
}

export default function ImportLocalScheduleSection() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ schedule: 0, calendar: 0, dayCities: 0, dayExtras: 0 });
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  useEffect(() => {
    refresh();
    pruneStaleBackups();
  }, []);

  function refresh() {
    setCounts(readLiveCounts());
    setBackups(readBackups());
  }

  function pruneStaleBackups() {
    if (typeof window === "undefined") return;
    const now = new Date();
    const prefixes = Object.values(BACKUP_PREFIXES);
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      for (const prefix of prefixes) {
        if (k.startsWith(prefix)) {
          const date = k.slice(prefix.length);
          if (daysBetween(date, now) > BACKUP_TTL_DAYS) {
            window.localStorage.removeItem(k);
          }
          break;
        }
      }
    }
  }

  function totalLiveItems(): number {
    return counts.schedule + counts.calendar + counts.dayCities + counts.dayExtras;
  }

  async function runImport() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const schedules = loadSchedules();
      const calendar = loadCalendarSettings();
      const dayCities = loadDayCities();
      const dayExtras = loadDayExtras();

      const supabase = getSupabaseBrowser();
      // Single RPC call — atomic per the function body (one Postgres
      // transaction). If any INSERT raises, all four payloads roll back.
      const { error: rpcErr } = await supabase.rpc("import_schedule", {
        p_schedules: schedules as unknown as never,
        p_calendar_settings: calendar as unknown as never,
        p_day_cities: dayCities as unknown as never,
        p_day_extras: dayExtras as unknown as never,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      // On success: rename each live key to its dated backup and
      // clear the live key. Failure here is best-effort cleanup —
      // the cloud has the data, the user can manually clear later.
      const today = todayKey();
      const moveToBackup = (live: string, backupKey: string) => {
        const raw = window.localStorage.getItem(live);
        if (!raw) return;
        const existing = window.localStorage.getItem(backupKey);
        if (existing) {
          // Multiple imports in one day: keep newest as backup, drop
          // intermediate. Old backup is overwritten — this is a
          // post-import state, not a critical safety net.
          window.localStorage.setItem(backupKey, raw);
        } else {
          window.localStorage.setItem(backupKey, raw);
        }
        window.localStorage.removeItem(live);
      };
      moveToBackup(LIVE_KEYS.schedule, `${BACKUP_PREFIXES.schedule}${today}`);
      moveToBackup(LIVE_KEYS.calendar, `${BACKUP_PREFIXES.calendar}${today}`);
      moveToBackup(LIVE_KEYS.dayCities, `${BACKUP_PREFIXES.dayCities}${today}`);
      moveToBackup(LIVE_KEYS.dayExtras, `${BACKUP_PREFIXES.dayExtras}${today}`);

      router.refresh();
      refresh();
      setConfirmOpen(false);
      setDoneAt(Date.now());
      window.setTimeout(() => setDoneAt(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось импортировать");
    } finally {
      setBusy(false);
    }
  }

  function deleteBackup(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    refresh();
  }

  const total = totalLiveItems();
  if (total === 0 && backups.length === 0) return null;

  return (
    <>
      {total > 0 && (
        <div>
          <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
            <CalendarClock size={14} />
            <span>Локальное расписание</span>
          </div>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
              Не загружено в облако:
            </p>
            <ul className="text-[13px] text-[var(--label-secondary)] leading-snug space-y-1 pl-3">
              {counts.schedule > 0 && <li>• Расписание бригад: {counts.schedule}</li>}
              {counts.calendar > 0 && <li>• Настройки календаря: 1</li>}
              {counts.dayCities > 0 && <li>• Городов по дням: {counts.dayCities}</li>}
              {counts.dayExtras > 0 && <li>• Доп. строк по дням: {counts.dayExtras}</li>}
            </ul>
            <p className="text-[12px] text-[var(--label-tertiary)] leading-snug">
              После импорта локальные данные сохранятся как backup на 30 дней.
            </p>
            {error && (
              <div className="flex gap-2 items-start text-[13px] text-[var(--system-red)] leading-snug">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmOpen(true);
              }}
              disabled={busy}
              className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {doneAt ? (
                <>
                  <Check size={16} /> Импорт завершён
                </>
              ) : busy ? (
                "Импортируем…"
              ) : (
                "Импортировать в облако"
              )}
            </button>
          </div>
        </div>
      )}

      {backups.length > 0 && (
        <div>
          <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
            <Archive size={14} />
            <span>Backup-копии расписания</span>
          </div>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
            {backups.map((b) => {
              const days = daysBetween(b.date, new Date());
              const remaining = Math.max(0, BACKUP_TTL_DAYS - days);
              const label =
                b.entity === "schedule"
                  ? "Расписание"
                  : b.entity === "calendar"
                  ? "Настройки календаря"
                  : b.entity === "dayCities"
                  ? "Города по дням"
                  : "Доп. строки";
              return (
                <div
                  key={b.key}
                  className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--label)]">
                      {label} от {b.date}
                    </div>
                    <div className="text-[12px] text-[var(--label-tertiary)]">
                      Удалится через {remaining} дн.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBackup(b.key)}
                    className="px-3 h-9 rounded-[10px] bg-[rgba(255,59,48,0.10)] border border-[rgba(255,59,48,0.30)] text-[var(--system-red)] text-[13px] font-semibold active:bg-[rgba(255,59,48,0.18)] transition"
                  >
                    Удалить
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <CalendarClock size={20} />
              <h2 className="text-[17px] font-semibold">Импортировать в облако?</h2>
            </div>
            <p className="text-[14px] text-[var(--label-secondary)] leading-snug">
              Все 4 типа данных будут отправлены атомарно: при ошибке любой
              части ничего не сохранится. Локальные данные останутся как backup
              на 30 дней.
            </p>
            {error && (
              <div className="flex gap-2 items-start text-[13px] text-[var(--system-red)] leading-snug">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] disabled:opacity-50 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:opacity-40 active:scale-[0.98] transition"
              >
                {busy ? "Импортируем…" : "Импортировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
