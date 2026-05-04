"use client";

// STORY-069 — Managed SMS settings panel.
//
// Single client component that handles four sections:
//   1. Status card  — free trial counter OR balance
//   2. Sender name — pending / approved / rejected / not requested
//   3. Top-up      — three packs (Stripe Checkout in wave 2)
//   4. History     — last 20 sends
//
// Reminder toggles + templates kept on a separate component to keep
// this one focused; they live below in the page.

import { useState, useTransition } from "react";
import { Check, Clock, Send, Wallet } from "@babun/shared/icons";
import {
  cancelSenderRequest,
  createTopupCheckout,
  requestSenderName,
  TOPUP_PACKS,
  DEFAULT_FREE_SMS,
  PER_SMS_COST_CENTS,
  PLATFORM_DEFAULT_SENDER,
} from "@/app/dashboard/settings/sms/managed-actions";
import { haptic } from "@/lib/haptics";

export interface ManagedSmsConfig {
  enabled: boolean;
  sender_name: string | null;
  sender_status: "pending" | "approved" | "rejected" | null;
  sender_rejection_reason?: string | null;
  free_sms_remaining: number;
  total_sent_count: number;
  balance_cents: number;
}

export interface ManagedSmsLog {
  id: string;
  to_phone: string;
  body: string;
  sender_name_used: string;
  cost_cents: number;
  was_free: boolean;
  twilio_status: string | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
}

export default function ManagedSmsPanel({
  config,
  logs,
}: {
  config: ManagedSmsConfig;
  logs: ManagedSmsLog[];
}) {
  return (
    <div className="space-y-4">
      <StatusCard config={config} />
      <SenderCard config={config} />
      <TopupCard config={config} />
      <HistoryCard logs={logs} />
    </div>
  );
}

// ───────── Status (free trial / balance summary) ─────────

function StatusCard({ config }: { config: ManagedSmsConfig }) {
  const onTrial =
    config.free_sms_remaining > 0 && config.balance_cents === 0;
  const balanceSms = Math.floor(config.balance_cents / PER_SMS_COST_CENTS);
  const totalLeft = onTrial
    ? config.free_sms_remaining
    : balanceSms;
  const balanceEur = (config.balance_cents / 100).toFixed(2);

  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-[14px] flex items-center justify-center text-white shadow-sm ${
            onTrial
              ? "bg-[var(--accent)]"
              : config.balance_cents >= PER_SMS_COST_CENTS
                ? "bg-[var(--system-green)]"
                : "bg-[var(--system-orange)]"
          }`}
        >
          <Wallet size={22} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            {onTrial ? "Бесплатный пробник" : "Баланс SMS"}
          </div>
          <div className="text-[22px] font-semibold text-[var(--label)] tracking-tight tabular-nums">
            {totalLeft} <span className="text-[14px] font-medium text-[var(--label-secondary)]">SMS</span>
          </div>
          {!onTrial && (
            <div className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
              ≈ €{balanceEur}
            </div>
          )}
        </div>
      </div>
      {onTrial && (
        <p className="mt-3 text-[13px] text-[var(--label-secondary)] leading-snug">
          Babun даёт {DEFAULT_FREE_SMS} SMS бесплатно для теста — отправляются от имени «{PLATFORM_DEFAULT_SENDER}». Чтобы отправлять под своим брендом, оформи имя отправителя ниже и пополни баланс.
        </p>
      )}
      {!onTrial && config.balance_cents < PER_SMS_COST_CENTS && (
        <p className="mt-3 text-[13px] text-[var(--system-orange)] leading-snug font-medium">
          Баланс закончился. Пополни, чтобы продолжить отправку.
        </p>
      )}
      {config.total_sent_count > 0 && (
        <p className="mt-2 text-[11px] text-[var(--label-tertiary)] tabular-nums">
          Всего отправлено: {config.total_sent_count}
        </p>
      )}
    </section>
  );
}

// ───────── Sender Name ─────────

function SenderCard({ config }: { config: ManagedSmsConfig }) {
  const [name, setName] = useState(config.sender_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestSenderName(name);
      if (!res.ok) setError(res.error);
      else haptic("medium");
    });
  };

  const onCancel = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelSenderRequest();
      if (!res.ok) setError(res.error);
      else {
        haptic("warning");
        setName("");
      }
    });
  };

  // Three states: not requested / pending / approved / rejected.
  const status = config.sender_status;

  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Имя отправителя
        </div>
        {status === "approved" && (
          <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-[rgba(52,199,89,0.14)] text-[var(--system-green)] text-[10px] font-bold uppercase tracking-wide">
            <Check size={10} strokeWidth={3} /> одобрено
          </span>
        )}
        {status === "pending" && (
          <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)] text-[10px] font-bold uppercase tracking-wide">
            <Clock size={10} strokeWidth={3} /> на проверке
          </span>
        )}
        {status === "rejected" && (
          <span className="inline-flex items-center px-1.5 h-5 rounded-full bg-[rgba(255,59,48,0.14)] text-[var(--system-red)] text-[10px] font-bold uppercase tracking-wide">
            отклонено
          </span>
        )}
      </div>

      {status === "approved" ? (
        <div className="p-3 rounded-[12px] bg-[var(--fill-quaternary)]">
          <div className="text-[18px] font-semibold text-[var(--label)] tracking-tight">
            «{config.sender_name}»
          </div>
          <p className="text-[12px] text-[var(--label-tertiary)] mt-1 leading-snug">
            Все исходящие SMS приходят клиентам с этим именем. Изменить — напишите в поддержку.
          </p>
        </div>
      ) : status === "pending" ? (
        <>
          <div className="p-3 rounded-[12px] bg-[var(--fill-quaternary)]">
            <div className="text-[18px] font-semibold text-[var(--label)] tracking-tight">
              «{config.sender_name}»
            </div>
            <p className="text-[12px] text-[var(--label-tertiary)] mt-1 leading-snug">
              Регистрируем у оператора. Обычно занимает 1–48 часов. До одобрения SMS уходят от «{PLATFORM_DEFAULT_SENDER}».
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="mt-3 w-full h-9 rounded-[10px] text-[13px] font-medium text-[var(--system-red)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
          >
            Отменить заявку
          </button>
        </>
      ) : (
        <>
          {status === "rejected" && config.sender_rejection_reason && (
            <p className="mb-3 text-[13px] text-[var(--system-red)] leading-snug p-2 rounded-[10px] bg-[rgba(255,59,48,0.08)]">
              Причина отказа: {config.sender_rejection_reason}
            </p>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const upper = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9 ]/g, "")
                .slice(0, 11);
              setName(upper);
              setError(null);
            }}
            placeholder="AIRFIX"
            maxLength={11}
            className="w-full h-11 px-3 text-[16px] tracking-[0.04em] uppercase tabular-nums bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]"
          />
          <p className="mt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
            До 11 символов, латинские буквы / цифры / пробел. Должна быть минимум одна буква. Получатели увидят это имя вместо номера.
          </p>
          {error && (
            <p className="mt-2 text-[12px] text-[var(--system-red)]">{error}</p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || name.trim().length === 0}
            className={`mt-3 w-full h-11 rounded-[12px] text-[15px] font-semibold transition ${
              pending || name.trim().length === 0
                ? "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] cursor-not-allowed"
                : "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)]"
            }`}
          >
            {pending ? "Отправляем…" : "Отправить на одобрение"}
          </button>
        </>
      )}
    </section>
  );
}

// ───────── Top-up ─────────

function TopupCard({ config }: { config: ManagedSmsConfig }) {
  // config will drive a "balance is empty / pack to top-up" hint in
  // wave 2; for wave 1 we just keep the prop on the API so the
  // parent doesn't need to special-case the call site later.
  void config;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPick = (packId: string) => {
    setError(null);
    setBusyId(packId);
    startTransition(async () => {
      const res = await createTopupCheckout(packId);
      if (!res.ok) {
        setError(res.error);
        setBusyId(null);
      } else {
        window.location.href = res.url;
      }
    });
  };

  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        Пополнить баланс
      </div>
      <p className="text-[12px] text-[var(--label-tertiary)] mb-3 leading-snug">
        Выбери пакет — оплата через Stripe. SMS сразу зачисляются на баланс.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TOPUP_PACKS.map((p) => {
          const perSms = (p.amountCents / p.credits / 100).toFixed(3);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              disabled={pending}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-[14px] border border-[var(--separator)] active:bg-[var(--fill-tertiary)] disabled:opacity-50 transition relative"
            >
              {p.bonusLabel && (
                <span className="absolute top-1 right-1 inline-flex items-center px-1 h-4 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] text-[9px] font-bold tracking-wide">
                  {p.bonusLabel}
                </span>
              )}
              <span className="text-[18px] font-semibold text-[var(--label)] tracking-tight">
                €{p.amountCents / 100}
              </span>
              <span className="text-[12px] font-medium text-[var(--label-secondary)] tabular-nums">
                {p.credits} SMS
              </span>
              <span className="text-[10px] text-[var(--label-tertiary)] tabular-nums">
                ≈ €{perSms}/SMS
              </span>
            </button>
          );
        })}
      </div>
      {busyId && pending && (
        <p className="mt-3 text-[12px] text-[var(--label-secondary)] text-center">
          Открываем оплату…
        </p>
      )}
      {error && (
        <p className="mt-3 text-[12px] text-[var(--system-orange)] text-center leading-snug">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-[var(--label-tertiary)] text-center leading-snug">
        Безопасная оплата через Stripe · отмена не нужна — нет подписки · возврат по запросу
      </p>
    </section>
  );
}

// ───────── History ─────────

function HistoryCard({ logs }: { logs: ManagedSmsLog[] }) {
  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          История отправок
        </div>
        <p className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
          Последние 20 SMS
        </p>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 pb-5 pt-2 text-center text-[13px] text-[var(--label-tertiary)] flex flex-col items-center gap-1.5">
          <Send size={18} strokeWidth={1.6} className="text-[var(--label-quaternary)]" />
          Пока ни одной отправки.
        </div>
      ) : (
        <div className="divide-y divide-[var(--separator)]">
          {logs.map((l) => (
            <LogRow key={l.id} log={l} />
          ))}
        </div>
      )}
    </section>
  );
}

function LogRow({ log }: { log: ManagedSmsLog }) {
  const status = log.twilio_status ?? "queued";
  const ok = status === "delivered" || status === "sent";
  const failed =
    status === "failed" ||
    status === "undelivered" ||
    Boolean(log.error_message);
  const dateLabel = new Date(log.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  const timeLabel = new Date(log.created_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--label)] tabular-nums">
              {log.to_phone}
            </span>
            {log.was_free && (
              <span className="inline-flex items-center px-1 h-4 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] text-[9px] font-bold uppercase tracking-wide">
                free
              </span>
            )}
          </div>
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 line-clamp-2 leading-snug">
            {log.body}
          </div>
          <div className="text-[11px] text-[var(--label-tertiary)] mt-0.5 tabular-nums">
            {dateLabel} · {timeLabel} · от «{log.sender_name_used}»
            {log.cost_cents > 0 && ` · €${(log.cost_cents / 100).toFixed(2)}`}
          </div>
          {log.error_message && (
            <div className="text-[11px] text-[var(--system-red)] mt-0.5 leading-snug">
              Ошибка: {log.error_message}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 h-5 inline-flex items-center rounded-full ${
            ok
              ? "bg-[rgba(52,199,89,0.14)] text-[var(--system-green)]"
              : failed
                ? "bg-[rgba(255,59,48,0.14)] text-[var(--system-red)]"
                : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)]"
          }`}
        >
          {ok ? "ok" : failed ? "ошибка" : "ожидание"}
        </span>
      </div>
    </div>
  );
}
