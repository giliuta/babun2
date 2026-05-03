"use client";

// STORY-047 G5 — last-50 SMS history with status filter + click-row
// detail modal. Tenant-scoped reads via the regular RLS policy on
// sms_messages (no service-role needed here).

import { useMemo, useState } from "react";
import type { SmsMessageRow, SmsStatus } from "./types";

interface Props {
  rows: SmsMessageRow[];
}

const STATUS_LABEL: Record<SmsStatus, string> = {
  queued: "В очереди",
  sent: "Отправлено",
  delivered: "Доставлено",
  failed: "Ошибка",
  undelivered: "Не доставлено",
};

const STATUS_TONE: Record<SmsStatus, string> = {
  queued: "bg-[var(--fill-primary)] text-[var(--label-secondary)]",
  sent: "bg-[var(--system-blue)]/15 text-[var(--system-blue)]",
  delivered: "bg-[var(--system-green,#34C759)]/15 text-[var(--system-green,#34C759)]",
  failed: "bg-[var(--system-red,#FF3B30)]/15 text-[var(--system-red,#FF3B30)]",
  undelivered: "bg-[var(--system-orange,#FF9500)]/15 text-[var(--system-orange,#FF9500)]",
};

export default function SmsHistoryTable({ rows }: Props) {
  const [filter, setFilter] = useState<"all" | SmsStatus>("all");
  const [openRow, setOpenRow] = useState<SmsMessageRow | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [filter, rows],
  );

  const stats = useMemo(() => {
    const sent = rows.filter((r) => r.status === "sent" || r.status === "delivered").length;
    const delivered = rows.filter((r) => r.status === "delivered").length;
    const failed = rows.filter((r) => r.status === "failed" || r.status === "undelivered").length;
    return { sent, delivered, failed, total: rows.length };
  }, [rows]);

  return (
    <section className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-tile)] p-4 space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold text-[var(--label)]">История</h2>
        <span className="text-[12px] text-[var(--label-secondary)]">
          {rows.length === 0 ? "Пока пусто" : `Последние ${rows.length}`}
        </span>
      </header>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Отправлено" value={stats.sent} />
          <Stat label="Доставлено" value={stats.delivered} />
          <Stat label="Ошибки" value={stats.failed} />
        </div>
      )}

      {/* Filter */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={`Все ${rows.length}`} />
          {(["delivered", "sent", "failed", "undelivered", "queued"] as SmsStatus[])
            .filter((s) => rows.some((r) => r.status === s))
            .map((s) => (
              <FilterPill
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                label={STATUS_LABEL[s]}
              />
            ))}
        </div>
      )}

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-[14px] text-[var(--label-secondary)] py-6 text-center">
          {rows.length === 0
            ? "Записи появятся, когда система отправит первое SMS."
            : "Нет записей с этим статусом."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setOpenRow(row)}
              className="w-full text-left px-3 py-2 rounded-[10px] bg-[var(--surface-card-secondary)] active:opacity-70 transition flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--label)] truncate">
                  {row.to_phone}
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] truncate">
                  {relativeTime(new Date(row.created_at).getTime())} · {triggerLabel(row.trigger_type)}
                </div>
              </div>
              <span
                className={`shrink-0 px-2 h-6 rounded-full text-[11px] font-semibold flex items-center ${STATUS_TONE[row.status]}`}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {openRow && <DetailModal row={openRow} onClose={() => setOpenRow(null)} />}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--surface-card-secondary)] rounded-[10px] py-2">
      <div className="text-[18px] font-bold text-[var(--label)]">{value}</div>
      <div className="text-[11px] text-[var(--label-secondary)]">{label}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 h-7 rounded-full text-[12px] font-semibold transition ${
        active
          ? "bg-[var(--system-blue)] text-white"
          : "bg-[var(--surface-card-secondary)] text-[var(--label-secondary)] active:opacity-70"
      }`}
    >
      {label}
    </button>
  );
}

function DetailModal({ row, onClose }: { row: SmsMessageRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className={`px-2 h-6 rounded-full text-[11px] font-semibold flex items-center ${STATUS_TONE[row.status]}`}>
            {STATUS_LABEL[row.status]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--system-blue)] text-[14px] font-semibold"
          >
            Готово
          </button>
        </div>
        <DetailRow label="Кому" value={row.to_phone} />
        <DetailRow label="Когда" value={new Date(row.created_at).toLocaleString("ru-RU")} />
        {row.delivered_at && (
          <DetailRow label="Доставлено" value={new Date(row.delivered_at).toLocaleString("ru-RU")} />
        )}
        <DetailRow label="Триггер" value={triggerLabel(row.trigger_type)} />
        <DetailRow label="Режим" value={row.mode === "platform" ? "Babun" : "Свой Twilio"} />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--label-secondary)] mb-1">
            Текст
          </div>
          <div className="text-[14px] text-[var(--label)] whitespace-pre-wrap bg-[var(--surface-card-secondary)] rounded-[10px] p-3">
            {row.message_body}
          </div>
        </div>
        {(row.error_code || row.error_message) && (
          <div className="bg-[var(--system-red,#FF3B30)]/10 rounded-[10px] p-3">
            {row.error_code && (
              <div className="text-[12px] text-[var(--system-red,#FF3B30)] font-semibold">
                {row.error_code}
              </div>
            )}
            {row.error_message && (
              <div className="text-[13px] text-[var(--label)] mt-1">{row.error_message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-[var(--label-secondary)]">{label}</span>
      <span className="text-[13px] text-[var(--label)] text-right truncate">{value}</span>
    </div>
  );
}

function relativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(ms).toLocaleDateString("ru-RU");
}

function triggerLabel(t: string): string {
  switch (t) {
    case "reminder_24h":
      return "За 24 ч";
    case "reminder_2h":
      return "За 2 ч";
    case "manual":
      return "Вручную";
    case "test":
      return "Тест";
    default:
      return t;
  }
}
