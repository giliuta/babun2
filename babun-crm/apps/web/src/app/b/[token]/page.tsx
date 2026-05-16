"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { Link2Off, MapPin } from "@babun/shared/icons";
import { decodeShareSnapshot } from "@babun/shared/common/utils/share-link";
import { formatEUR } from "@babun/shared/common/utils/money";

// Public share page — no auth, no dashboard chrome. iOS receipt
// aesthetic: white card on grouped canvas, big time at the top,
// 15-px rows below. Sprint 029 Phase 6 redesign.

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage(props: PageProps) {
  const { token } = use(props.params);
  const snapshot = useMemo(() => decodeShareSnapshot(token), [token]);

  if (!snapshot) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-grouped)] px-6 text-center">
        <div className="w-14 h-14 rounded-[18px] bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center mb-4">
          <Link2Off size={22} strokeWidth={2} />
        </div>
        <h1 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
          Ссылка больше не работает
        </h1>
        <p className="mt-2 text-[13px] text-[var(--label-secondary)] max-w-sm leading-snug">
          Попросите мастера прислать актуальную ссылку на запись.
        </p>
        <Link
          href="/"
          className="mt-6 text-[15px] font-medium text-[var(--accent)] active:opacity-60"
        >
          На главную
        </Link>
      </main>
    );
  }

  const statusLabel = statusMap[snapshot.st ?? "scheduled"] ?? "Запланирована";
  const dateLabel = formatDateRu(snapshot.d);
  const services = snapshot.s?.join(" · ") ?? "";

  return (
    <main
      className="min-h-screen bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="text-center mb-6">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Ваша запись
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)]">
            {statusLabel}
          </div>
        </div>

        <div className="bg-[var(--surface-card)] rounded-[16px] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          <div className="px-5 pt-6 pb-5 text-center">
            <div className="text-[13px] font-medium text-[var(--label-secondary)] capitalize">
              {dateLabel}
            </div>
            <div className="mt-1 text-[32px] font-bold tabular-nums tracking-tight text-[var(--label)]">
              {snapshot.ts}
              <span className="text-[var(--label-tertiary)] mx-1">—</span>
              {snapshot.te}
            </div>
          </div>

          {services && <Row label="Услуги" value={services} />}
          {snapshot.c && <Row label="Имя" value={snapshot.c} />}
          {snapshot.b && <Row label="Команда" value={snapshot.b} />}
          {snapshot.a && <AddressRow address={snapshot.a} />}
          {typeof snapshot.t === "number" && snapshot.t > 0 && (
            <Row
              label="Сумма"
              value={
                <span className="tabular-nums font-semibold text-[var(--label)] text-[17px]">
                  {formatEUR(snapshot.t)}
                </span>
              }
            />
          )}
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--label-tertiary)] leading-snug">
          Ссылка создана мастером. Данные действительны на момент отправки.
        </p>
      </div>
    </main>
  );
}

const statusMap: Record<string, string> = {
  scheduled: "Запланирована",
  in_progress: "В работе",
  completed: "Выполнена",
  cancelled: "Отменена",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3 flex items-start gap-3 min-h-[48px]">
      <div className="w-20 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] pt-0.5">
        {label}
      </div>
      <div className="flex-1 text-[15px] text-[var(--label)]">{value}</div>
    </div>
  );
}

function AddressRow({ address }: { address: string }) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <div className="px-5 py-3 flex items-start gap-3 min-h-[48px]">
      <div className="w-20 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] pt-0.5">
        Адрес
      </div>
      <div className="flex-1 text-[15px] text-[var(--label)]">
        <div>{address}</div>
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1.5 text-[13px] font-medium text-[var(--accent)] active:opacity-60"
        >
          <MapPin size={14} strokeWidth={2.2} />
          Открыть на карте
        </a>
      </div>
    </div>
  );
}

function formatDateRu(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const weekday = date.toLocaleDateString("ru", { weekday: "long" });
  const dayName = date.toLocaleDateString("ru", { day: "numeric", month: "long" });
  return `${weekday}, ${dayName}`;
}
