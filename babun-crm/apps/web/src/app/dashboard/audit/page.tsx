"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Trash2, Search, X, Download } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  clearAuditLog,
  loadAuditLog,
  type AuditEntry,
  type AuditEntityKind,
} from "@/lib/audit/audit-log";
import { buildCsv, downloadCsv, type CsvColumn } from "@/lib/finance/csv-export";

// v598 §4.4 — Local activity log inbox.
//
// Lists the per-device write trail captured via `logAudit()`. Each
// row carries timestamp, entity tag (Запись / Клиент / …), action
// verb, free-text summary. Filter chips at the top scope the list
// by entity kind — useful for «show me what I did to clients
// today».
//
// Source-of-truth boundary: the log is per-device. A future commit
// can lift it to Supabase so other tenant users see the same
// trail, but the v1 ships the cheapest 80% of the value.

const ENTITY_LABEL: Record<AuditEntityKind, string> = {
  appointment: "Запись",
  client: "Клиент",
  service: "Услуга",
  master: "Сотрудник",
  team: "Команда",
  expense: "Расход",
  income: "Доход",
  settings: "Настройки",
};

const ENTITY_TILE: Record<AuditEntityKind, string> = {
  appointment: "bg-[var(--tile-blue)]",
  client: "bg-[var(--tile-indigo)]",
  service: "bg-[var(--tile-purple)]",
  master: "bg-[var(--tile-mint)]",
  team: "bg-[var(--tile-cyan)]",
  expense: "bg-[var(--tile-red)]",
  income: "bg-[var(--tile-green)]",
  settings: "bg-[var(--tile-gray)]",
};

const ACTION_LABEL = {
  create: "Создано",
  update: "Изменено",
  delete: "Удалено",
  status_change: "Статус",
  import: "Импорт",
  export: "Экспорт",
} as const;

// v620 §4.4 — Four-column preset for the audit CSV export.
// Raw ISO timestamp so the user can sort/filter precisely in Excel.
const AUDIT_CSV_COLUMNS: CsvColumn<AuditEntry>[] = [
  { header: "Время", accessor: (e) => e.ts },
  { header: "Раздел", accessor: (e) => ENTITY_LABEL[e.entity] },
  { header: "Действие", accessor: (e) => ACTION_LABEL[e.action] },
  { header: "Описание", accessor: (e) => e.summary },
];

function formatTs(iso: string): string {
  const dt = new Date(iso);
  const today = new Date();
  const isToday =
    dt.getFullYear() === today.getFullYear() &&
    dt.getMonth() === today.getMonth() &&
    dt.getDate() === today.getDate();
  const time = dt.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return time;
  const date = dt
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(/\.$/, "");
  return `${date}, ${time}`;
}

export default function AuditLogPage() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<AuditEntityKind | "all">("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    setEntries(loadAuditLog());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("babun:audit-log-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("babun:audit-log-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && e.entity !== filter) return false;
      if (q && !e.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, query]);

  const presentKinds = useMemo(() => {
    const set = new Set<AuditEntityKind>();
    for (const e of entries) set.add(e.entity);
    return Array.from(set);
  }, [entries]);

  const handleClear = async () => {
    if (entries.length === 0) return;
    const ok = await confirm({
      title: "Очистить локальный журнал?",
      message: `Все ${entries.length} записей с этого устройства будут удалены. Журнал хранится только локально — никаких внешних копий не будет.`,
      confirmLabel: "Очистить",
      danger: true,
    });
    if (!ok) return;
    clearAuditLog();
  };

  const handleExportCsv = () => {
    const csv = buildCsv(AUDIT_CSV_COLUMNS, entries);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `babun-audit-${dateStamp}`);
  };

  return (
    <>
      <PageHeader
        title={`Журнал${entries.length > 0 ? ` (${entries.length})` : ""}`}
        rightContent={
          <div className="flex items-center gap-1">
            {/* v620 §4.4 — CSV export. UTF-8 BOM + `;` separator + CRLF
                so Russian-locale Excel opens it cleanly. Disabled when
                the log is empty. */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              aria-label="Экспортировать журнал в CSV"
              className="inline-flex items-center gap-1.5 px-2 py-1.5 lg:px-3 text-[13px] font-medium text-[var(--accent)] active:opacity-70 hover:bg-[var(--fill-tertiary)] rounded-lg disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
            >
              <Download size={14} strokeWidth={2} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 lg:px-3 text-[13px] font-medium text-[var(--tile-red)] active:opacity-70 hover:bg-[var(--fill-tertiary)] rounded-lg disabled:opacity-0 disabled:pointer-events-none"
              aria-label="Очистить журнал"
            >
              <Trash2 size={14} strokeWidth={2} />
              Очистить
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {entries.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={24} strokeWidth={2} />}
              title="Журнал пока пуст"
              description="Здесь появится локальный список ваших действий: создание/изменение записей, клиентов, расходов и т.д. Журнал хранится только на этом устройстве."
            />
          ) : (
            <>
              {/* v607 — search by summary text. Useful when the
                  journal accumulates a few hundred entries and the
                  dispatcher needs to find «Иван» or «отменено». */}
              <div className="relative">
                <Search
                  size={14}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по описанию"
                  className="w-full h-10 pl-9 pr-9 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:border-[var(--accent)] transition"
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Очистить поиск"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-tertiary)]"
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                )}
              </div>
              {presentKinds.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                  <FilterChip
                    label="Все"
                    active={filter === "all"}
                    onClick={() => setFilter("all")}
                  />
                  {presentKinds.map((k) => (
                    <FilterChip
                      key={k}
                      label={ENTITY_LABEL[k]}
                      active={filter === k}
                      onClick={() => setFilter(k)}
                    />
                  ))}
                </div>
              )}
              <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
                {visible.map((e, idx) => (
                  <AuditRow key={`${e.ts}-${idx}`} entry={e} />
                ))}
                {visible.length === 0 && (
                  <div className="px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
                    {query.length > 0
                      ? `Ничего не найдено по запросу «${query}»`
                      : "В этой категории пока ничего нет"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-medium transition ${
        active
          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
          : "bg-[var(--fill-quaternary)] text-[var(--label)] active:bg-[var(--fill-tertiary)]"
      }`}
    >
      {label}
    </button>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 w-7 h-7 rounded-[var(--radius-tile)] flex items-center justify-center text-[11px] font-semibold text-[var(--label-on-accent)] shrink-0 ${ENTITY_TILE[entry.entity]}`}
      >
        {ENTITY_LABEL[entry.entity][0]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            {ENTITY_LABEL[entry.entity]} · {ACTION_LABEL[entry.action]}
          </div>
          <div className="text-[11px] text-[var(--label-tertiary)] tabular-nums shrink-0">
            {formatTs(entry.ts)}
          </div>
        </div>
        <div className="text-[14px] text-[var(--label)] mt-0.5 leading-snug">
          {entry.summary}
        </div>
      </div>
    </div>
  );
}
