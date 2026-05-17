"use client";

// STORY-060 §F3.4 — sync health indicator.
//
// Small colored-dot + relative-time badge that surfaces synchronisation
// health next to the build-version chip. Updates every 30 s. Reacts
// immediately to browser `online`/`offline` events.

import { useCallback, useEffect, useRef, useState } from "react";

export interface SyncIndicatorProps {
  /** ISO timestamp of last successful sync. null = never synced. */
  lastSyncAt: string | null;
  /** True when a sync error occurred since last success. */
  hasError?: boolean;
  /** Optional error message for the popover. */
  errorMessage?: string;
}

type SyncStatus = "ok" | "idle" | "stale" | "error";

const STATUS_DOT: Record<SyncStatus, string> = {
  ok: "#22C55E",
  idle: "#9CA3AF",
  stale: "#F59E0B",
  error: "#EF4444",
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  ok: "Всё хорошо",
  idle: "Тишина",
  stale: "Не было давно",
  error: "Ошибка",
};

function deriveStatus(
  lastSyncAt: string | null,
  hasError: boolean,
  now: number,
  online: boolean,
): SyncStatus {
  if (hasError) return "error";
  if (!lastSyncAt) return online ? "idle" : "error";
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return "error";
  const ageMs = now - t;
  if (ageMs > 5 * 60_000) return online ? "stale" : "error";
  if (ageMs <= 60_000) return "ok";
  return "idle";
}

function formatRelative(lastSyncAt: string | null, now: number): string {
  if (!lastSyncAt) return "—";
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t);
  const today = new Date(now);
  const isSameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const yesterday = new Date(now - 86_400_000);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (isSameDay) return `Синхр. ${hh}:${mm}`;
  if (isYesterday) return `Вчера ${hh}:${mm}`;
  return "Давно";
}

const RU_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

function formatAbsolute(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "Не было";
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return "Не было";
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}, ${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

export default function SyncIndicator({
  lastSyncAt,
  hasError = false,
  errorMessage,
}: SyncIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    const onOnline = () => {
      setOnline(true);
      setNow(Date.now());
    };
    const onOffline = () => {
      setOnline(false);
      setNow(Date.now());
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const status = deriveStatus(lastSyncAt, hasError, now, online);
  const relative = formatRelative(lastSyncAt, now);
  const absolute = formatAbsolute(lastSyncAt);

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  const ariaLabel = `Состояние синхронизации: ${STATUS_LABEL[status].toLowerCase()}, последняя синхронизация ${absolute}`;

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--label-tertiary)] tabular-nums active:opacity-70 transition"
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: STATUS_DOT[status] }}
          aria-hidden
        />
        <span>{relative}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Статус синхронизации"
          className="absolute bottom-full left-0 mb-2 w-[240px] bg-[var(--surface-card)] rounded-[12px] border border-[var(--separator)] shadow-[0_8px_20px_rgba(0,0,0,0.18)] p-3 z-50"
        >
          <div className="text-[13px] font-semibold text-[var(--label)] mb-1">
            {STATUS_LABEL[status]}
          </div>
          <div className="text-[12px] text-[var(--label-secondary)]">
            {absolute}
          </div>
          {status === "error" && errorMessage ? (
            <div className="mt-2 text-[12px] text-[var(--system-red)]">
              {errorMessage}
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="ml-1 underline"
              >
                Подробнее
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
