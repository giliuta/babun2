"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { decodeShareSnapshot } from "@/lib/share-link";
import { formatEUR } from "@/lib/money";

// Public share page — no auth, no dashboard chrome. Renders an
// appointment snapshot that the dispatcher sent to the client via SMS.
// Everything lives in the token, so this page is reachable from any
// device without hitting any database.
//
// Keep it visually close to an iOS receipt: big date, time, services,
// address with navigation, total. Nothing editable — it's a confirmation.

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage(props: PageProps) {
  const { token } = use(props.params);
  const snapshot = useMemo(() => decodeShareSnapshot(token), [token]);

  if (!snapshot) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="text-4xl mb-3">🔗</div>
        <h1 className="text-lg font-semibold text-slate-900">
          Ссылка больше не работает
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Попросите мастера прислать актуальную ссылку на запись.
        </p>
        <Link
          href="/"
          className="mt-6 text-sm font-medium text-violet-600 active:opacity-60"
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
      className="min-h-screen bg-slate-50"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="text-center mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ваша запись
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{statusLabel}</div>
        </div>

        <div className="bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-5 pt-6 pb-4 text-center border-b border-slate-100">
            <div className="text-[13px] font-medium text-slate-500">
              {dateLabel}
            </div>
            <div className="mt-1 text-[32px] font-bold tabular-nums tracking-tight text-slate-900">
              {snapshot.ts}
              <span className="text-slate-300 mx-1">—</span>
              {snapshot.te}
            </div>
          </div>

          {services && (
            <Row label="Услуги" value={services} />
          )}
          {snapshot.c && <Row label="Имя" value={snapshot.c} />}
          {snapshot.b && <Row label="Бригада" value={snapshot.b} />}
          {snapshot.a && <AddressRow address={snapshot.a} />}
          {typeof snapshot.t === "number" && snapshot.t > 0 && (
            <Row
              label="Сумма"
              value={
                <span className="tabular-nums font-semibold text-slate-900 text-base">
                  {formatEUR(snapshot.t)}
                </span>
              }
            />
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
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

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 flex items-start gap-3 border-b border-slate-100 last:border-b-0">
      <div className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">
        {label}
      </div>
      <div className="flex-1 text-sm text-slate-700">{value}</div>
    </div>
  );
}

function AddressRow({ address }: { address: string }) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <div className="px-5 py-3 flex items-start gap-3 border-b border-slate-100 last:border-b-0">
      <div className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">
        Адрес
      </div>
      <div className="flex-1 text-sm text-slate-700">
        <div>{address}</div>
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1 text-[12px] font-medium text-violet-600 active:opacity-60"
        >
          Открыть на карте →
        </a>
      </div>
    </div>
  );
}

function formatDateRu(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const weekday = date.toLocaleDateString("ru", { weekday: "long" });
  const dayName = date.toLocaleDateString("ru", {
    day: "numeric",
    month: "long",
  });
  return `${weekday}, ${dayName}`;
}
