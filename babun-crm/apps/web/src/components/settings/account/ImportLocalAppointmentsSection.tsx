"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Archive, Check, AlertTriangle } from "@babun/shared/icons";
import {
  loadAppointments,
  type Appointment,
} from "@babun/shared/local/appointments";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { createAppointment as createAppointmentRepo } from "@babun/shared/db/repositories/appointments";
import { useAppointments } from "@/components/layout/DashboardClientLayout";

// STORY-042 G6 — one-shot import of localStorage appointments into
// Supabase, with a 30-day local backup so the user can verify cloud
// data before fully cutting over. The component renders nothing if
// there's no live local data AND no backup key.
//
// Live local key:  babun-appointments              (managed by @babun/shared/local/appointments)
// Backup key:      babun:appointments:backup-YYYY-MM-DD   (rotated daily, auto-pruned at 30 days)

const LIVE_KEY = "babun-appointments";
const BACKUP_PREFIX = "babun:appointments:backup-";

interface BackupInfo {
  key: string;
  date: string; // YYYY-MM-DD
  count: number;
}

function readBackups(): BackupInfo[] {
  if (typeof window === "undefined") return [];
  const out: BackupInfo[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(BACKUP_PREFIX)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        out.push({
          key: k,
          date: k.slice(BACKUP_PREFIX.length),
          count: parsed.length,
        });
      }
    } catch {
      // ignore malformed
    }
  }
  // Newest first.
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

const BACKUP_TTL_DAYS = 30;

export default function ImportLocalAppointmentsSection() {
  const router = useRouter();
  const { reloadAppointments } = useAppointments();
  const [liveCount, setLiveCount] = useState(0);
  const [oldestDate, setOldestDate] = useState<string | null>(null);
  const [newestDate, setNewestDate] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  // Hydrate counts on mount.
  useEffect(() => {
    refresh();
    // Auto-prune backups older than the TTL — fire-and-forget on every
    // mount of this section. Idempotent.
    pruneStaleBackups();
  }, []);

  function refresh() {
    const list = loadAppointments();
    setLiveCount(list.length);
    if (list.length > 0) {
      const dates = list.map((a) => a.date).filter(Boolean).sort();
      setOldestDate(dates[0] ?? null);
      setNewestDate(dates[dates.length - 1] ?? null);
    } else {
      setOldestDate(null);
      setNewestDate(null);
    }
    setBackups(readBackups());
  }

  function pruneStaleBackups() {
    if (typeof window === "undefined") return;
    const now = new Date();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(BACKUP_PREFIX)) continue;
      const date = k.slice(BACKUP_PREFIX.length);
      if (daysBetween(date, now) > BACKUP_TTL_DAYS) {
        window.localStorage.removeItem(k);
      }
    }
  }

  async function runImport() {
    if (busy) return;
    const list = loadAppointments();
    if (list.length === 0) {
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: list.length });
    try {
      const supabase = getSupabaseBrowser();
      // STORY-039 — pull active tenant from JWT app_metadata; falls
      // back to tenant_members for the fresh-signup race.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Сессия истекла");
      let tenantId =
        (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
        null;
      if (!tenantId) {
        const { data: membership } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", user.id)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        tenantId = membership?.tenant_id ?? null;
      }
      if (!tenantId) {
        throw new Error("Не удалось найти tenant");
      }

      // Batched insert — 50 per group keeps progress feedback smooth
      // and the request payload below the PostgREST default limit.
      const BATCH = 50;
      let done = 0;
      for (let i = 0; i < list.length; i += BATCH) {
        const slice = list.slice(i, i + BATCH);
        // No bulk endpoint in our repo; fire create one-by-one inside
        // a Promise.all per batch. Race-safe: each row is independent.
        const results = await Promise.allSettled(
          slice.map((a: Appointment) => createAppointmentRepo(supabase, a, tenantId)),
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          const reasons = failed
            .map((r) =>
              r.status === "rejected" ? String(r.reason).slice(0, 80) : "",
            )
            .filter(Boolean)
            .slice(0, 2);
          throw new Error(
            `Импорт прерван на ${done + slice.length - failed.length}/${list.length}. Ошибка: ${reasons.join("; ")}`,
          );
        }
        done += slice.length;
        setProgress({ done, total: list.length });
      }

      // Move live → backup. Don't clear without backup — the brief
      // (decision A7) wants 30-day fallback. Store under
      // `babun:appointments:backup-<today>`. If a backup for today
      // already exists, append (rare — re-import same day).
      const today = todayKey();
      const backupKey = `${BACKUP_PREFIX}${today}`;
      const liveRaw = window.localStorage.getItem(LIVE_KEY);
      if (liveRaw) {
        const existingBackupRaw = window.localStorage.getItem(backupKey);
        if (existingBackupRaw) {
          try {
            const a = JSON.parse(existingBackupRaw);
            const b = JSON.parse(liveRaw);
            const merged = Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : b;
            window.localStorage.setItem(backupKey, JSON.stringify(merged));
          } catch {
            window.localStorage.setItem(backupKey, liveRaw);
          }
        } else {
          window.localStorage.setItem(backupKey, liveRaw);
        }
        window.localStorage.removeItem(LIVE_KEY);
      }

      // Refresh the calendar + this section. Don't await — we already
      // showed the success toast.
      void reloadAppointments();
      router.refresh();
      refresh();
      setConfirmOpen(false);
      setDoneAt(Date.now());
      window.setTimeout(() => setDoneAt(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось импортировать");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function deleteBackup(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    refresh();
  }

  // Render nothing when there's neither live data nor backups.
  if (liveCount === 0 && backups.length === 0) return null;

  return (
    <>
      {liveCount > 0 && (
        <div>
          <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
            <CloudUpload size={14} />
            <span>Локальные записи календаря</span>
          </div>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
              {liveCount} записей в этом устройстве пока не загружены в облако.
              {oldestDate && newestDate && (
                <>
                  <br />
                  Период: {oldestDate} → {newestDate}.
                </>
              )}
            </p>
            <p className="text-[12px] text-[var(--label-tertiary)] leading-snug">
              После импорта локальные данные сохранятся в backup-копии на 30 дней.
            </p>
            {error && (
              <div className="text-[13px] text-[var(--system-red)] leading-snug">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmOpen(true);
              }}
              disabled={busy}
              className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition flex items-center justify-center gap-2"
            >
              {doneAt ? (
                <>
                  <Check size={16} /> Импорт завершён
                </>
              ) : busy && progress ? (
                `Импортируем: ${progress.done} / ${progress.total}`
              ) : (
                `Импортировать ${liveCount} записей в облако`
              )}
            </button>
          </div>
        </div>
      )}

      {backups.length > 0 && (
        <div>
          <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
            <Archive size={14} />
            <span>Локальные backup-копии</span>
          </div>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
            {backups.map((b) => {
              const days = daysBetween(b.date, new Date());
              const remaining = Math.max(0, BACKUP_TTL_DAYS - days);
              return (
                <div
                  key={b.key}
                  className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--label)]">
                      Backup от {b.date} ({b.count} записей)
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
              <CloudUpload size={20} />
              <h2 className="text-[17px] font-semibold">
                Импортировать в облако?
              </h2>
            </div>
            <p className="text-[14px] text-[var(--label-secondary)] leading-snug">
              {liveCount} локальных записей будут отправлены в Supabase.
              Каждая получит свежий UUID. Локальная копия сохранится как
              backup на 30 дней — можно удалить раньше из этого раздела.
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
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:scale-[0.98] transition"
              >
                {busy && progress
                  ? `${progress.done} / ${progress.total}`
                  : "Импортировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
