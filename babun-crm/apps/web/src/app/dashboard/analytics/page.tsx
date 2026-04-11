"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAppointments, useClients } from "@/app/dashboard/layout";
import {
  computeSegmentStats,
  computeAcquisitionStats,
  type ClientSegment,
  type Client,
} from "@/lib/clients";

const SEGMENT_COLORS: Record<ClientSegment, string> = {
  all: "#6366f1",
  active: "#10b981",
  sleeping: "#f59e0b",
  lost: "#6b7280",
  new: "#3b82f6",
  upcoming: "#8b5cf6",
  single: "#06b6d4",
  none: "#94a3b8",
  debtors: "#ef4444",
  prepaid: "#14b8a6",
  discounted: "#ec4899",
};

const SEGMENT_DESCRIPTIONS: Record<ClientSegment, string> = {
  all: "Всего в базе",
  active: "Были записи за последние 3 месяца или есть предстоящие",
  sleeping: "Были записи, но не было за последние 3 месяца",
  lost: "Нет записей больше 6 месяцев",
  new: "Первая запись в последние 30 дней или в будущем",
  upcoming: "Есть запланированные будущие записи",
  single: "Всего одна запись за всё время",
  none: "Ни одной активной записи",
  debtors: "Отрицательный баланс (долг)",
  prepaid: "Положительный баланс (предоплата)",
  discounted: "Имеют персональную скидку",
};

export default function AnalyticsPage() {
  const { clients } = useClients();
  const { appointments } = useAppointments();
  const [selected, setSelected] = useState<ClientSegment>("all");

  const stats = useMemo(() => computeSegmentStats(clients, appointments), [clients, appointments]);
  const acquisitionStats = useMemo(() => computeAcquisitionStats(clients), [clients]);
  const activeStat = stats.find((s) => s.segment === selected) ?? stats[0];

  return (
    <>
      <PageHeader title="Аналитика клиентов" subtitle={`${clients.length} клиентов`} />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto p-3 lg:p-4 pb-24 space-y-4">
          {/* Acquisition sources — horizontal bar breakdown */}
          {acquisitionStats.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                Откуда приходят клиенты
              </div>
              <div className="space-y-2">
                {acquisitionStats.map((a) => (
                  <div key={a.source}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{a.label}</span>
                      <span className="text-gray-500">
                        {a.count} <span className="text-gray-400">({a.percent}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${a.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Segment cards grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
            {stats.map((s) => {
              const isActive = s.segment === selected;
              const color = SEGMENT_COLORS[s.segment];
              return (
                <button
                  key={s.segment}
                  type="button"
                  onClick={() => setSelected(s.segment)}
                  className={`bg-white rounded-xl border-2 p-3 text-left transition-all ${
                    isActive
                      ? "border-indigo-500 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[11px] text-gray-500 leading-tight">{s.label}</div>
                    <div
                      className="w-2 h-2 rounded-full mt-1"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900">{s.count}</div>
                  <div className="text-[10px] text-gray-400">{s.percent}%</div>
                </button>
              );
            })}
          </div>

          {/* Selected segment detail */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div
              className="px-4 py-3 border-b border-gray-200"
              style={{ backgroundColor: `${SEGMENT_COLORS[activeStat.segment]}10` }}
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{activeStat.label}</h2>
                <span className="text-sm text-gray-500">
                  {activeStat.count} ({activeStat.percent}%)
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{SEGMENT_DESCRIPTIONS[activeStat.segment]}</p>
            </div>

            {activeStat.clients.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                В этом сегменте пока нет клиентов
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {activeStat.clients.map((c) => (
                  <ClientRow key={c.id} client={c} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ClientRow({ client }: { client: Client }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
        {client.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{client.full_name}</div>
        <div className="text-xs text-gray-500 truncate">{client.phone}</div>
      </div>
      {client.balance !== 0 && (
        <div
          className={`text-xs font-semibold ${
            client.balance < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {client.balance > 0 ? "+" : ""}
          {client.balance}€
        </div>
      )}
      {client.discount > 0 && (
        <div className="text-xs text-pink-600 font-semibold">−{client.discount}%</div>
      )}
    </div>
  );
}
