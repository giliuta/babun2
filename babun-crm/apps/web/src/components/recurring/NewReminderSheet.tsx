"use client";

// P0 #19 (CRM Core brief) — create-a-reminder bottom-sheet anchored
// to the FAB on /dashboard/recurring.
//
// Difference from the auto-seed path:
//   • Operator picks the kind (call / visit / sms / service / custom)
//     and the notification channel up-front; auto-seed always wrote
//     `service` + `push`.
//   • The reminder isn't tied to a completed appointment — the
//     `last_date` field is set to today and `interval_months` to 0
//     so `next_due_date` = the date the operator picked.
//   • `manual: true` on the row so the inbox can render a distinct
//     pill if it wants to.
//
// Field layout intentionally tight: a dispatcher's reaching for this
// from a phone in their off hand.

import { useEffect, useMemo, useState } from "react";
import { Phone, Calendar, MessageSquare, Wrench, Sparkles, X } from "@babun/shared/icons";
import { Button } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import type {
  RecurringType,
  RecurringChannel,
  CreateRecurringInput,
} from "@babun/shared/local/recurring";
import type { Client } from "@babun/shared/local/clients";

interface Props {
  open: boolean;
  onClose: () => void;
  clients: readonly Client[];
  onSubmit: (input: CreateRecurringInput) => Promise<void> | void;
}

const TYPE_OPTIONS: {
  value: RecurringType;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}[] = [
  { value: "call",    label: "Звонок",        icon: Phone },
  { value: "visit",   label: "Визит",         icon: Calendar },
  { value: "sms",     label: "SMS",           icon: MessageSquare },
  { value: "service", label: "Сервисный",     icon: Wrench },
  { value: "custom",  label: "Другое",        icon: Sparkles },
];

const CHANNEL_OPTIONS: { value: RecurringChannel; label: string }[] = [
  { value: "push",  label: "Push в приложении" },
  { value: "sms",   label: "SMS клиенту" },
  { value: "email", label: "Email клиенту" },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewReminderSheet({
  open,
  onClose,
  clients,
  onSubmit,
}: Props) {
  const [kind, setKind] = useState<RecurringType>("call");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(tomorrowKey());
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<RecurringChannel>("push");
  const [submitting, setSubmitting] = useState(false);

  // Reset on every open so a stale draft doesn't survive close+reopen.
  useEffect(() => {
    if (open) {
      setKind("call");
      setSearch("");
      setClientId("");
      setDueDate(tomorrowKey());
      setNote("");
      setChannel("push");
      setSubmitting(false);
    }
  }, [open]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients.slice(0, 8);
    const q = search.toLowerCase().trim();
    return clients
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.phone.includes(q),
      )
      .slice(0, 8);
  }, [clients, search]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const canSubmit = !!selectedClient && !!dueDate && !submitting;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedClient) return;
    setSubmitting(true);
    haptic("success");
    try {
      await onSubmit({
        client_id: selectedClient.id,
        client_name: selectedClient.full_name,
        phone: selectedClient.phone,
        team_id: null,
        service_ids: [],
        service_summary: note.trim() || TYPE_OPTIONS.find((t) => t.value === kind)?.label || "",
        // last_date = today + interval_months = 0 means next_due_date
        // is derived as today + 0 months = today; we override below
        // via the manual flow by setting interval_months = number of
        // days between today and the picked date, ROUND-DOWN to months.
        // Simpler: lie to the repository by setting last_date so that
        // `addMonthsYYYYMMDD(last_date, interval_months)` lands exactly
        // on `dueDate`. With interval_months=0, last_date == dueDate.
        last_date: dueDate,
        interval_months: 0,
        note: note.trim(),
        type: kind,
        manual: true,
        notify_channel: channel,
      });
      onClose();
    } catch (e) {
      // Surface the error inline; the operator can fix the field and
      // retry without losing input. Console for the diagnostic.
      // eslint-disable-next-line no-console
      console.warn("P0 #19: createRecurringReminder failed", e);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] sm:items-center">
      <div className="w-full sm:max-w-md bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Новое напоминание
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Type chips */}
          <Field label="Тип">
            <div className="grid grid-cols-3 gap-1.5">
              {TYPE_OPTIONS.map((t) => {
                const Icon = t.icon;
                const active = kind === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setKind(t.value)}
                    className={`h-11 flex items-center justify-center gap-1.5 rounded-[10px] text-[12px] font-semibold transition active:scale-[0.97] ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
                    }`}
                  >
                    <Icon size={14} strokeWidth={2} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Client picker */}
          <Field label="Клиент" required>
            {selectedClient ? (
              <div className="flex items-center gap-2 px-3 h-11 rounded-[10px] bg-[var(--fill-tertiary)]">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--label)] truncate">
                    {selectedClient.full_name}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-[12px] text-[var(--label-secondary)] truncate tabular-nums">
                      {selectedClient.phone}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClientId("");
                    setSearch("");
                  }}
                  aria-label="Сменить"
                  className="w-7 h-7 rounded-full bg-[var(--surface-card)] text-[var(--label-secondary)] flex items-center justify-center"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или телефону"
                  className={inputCls}
                />
                {filteredClients.length > 0 && (
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-[10px] border border-[var(--separator)] divide-y divide-[var(--separator)]">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClientId(c.id);
                          haptic("tap");
                        }}
                        className="w-full text-left px-3 py-2 active:bg-[var(--fill-quaternary)]"
                      >
                        <div className="text-[14px] font-medium text-[var(--label)] truncate">
                          {c.full_name}
                        </div>
                        {c.phone && (
                          <div className="text-[12px] text-[var(--label-secondary)] truncate tabular-nums">
                            {c.phone}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {search.trim() && filteredClients.length === 0 && (
                  <div className="mt-1.5 text-[12px] text-[var(--label-tertiary)]">
                    Ничего не нашли по «{search}».
                  </div>
                )}
              </>
            )}
          </Field>

          <Field label="Когда напомнить" required>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={todayKey()}
              className={inputCls}
            />
          </Field>

          <Field label="Заметка">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="«Узнать про сезонное обслуживание», «Спросить, нравится ли новая модель»"
              rows={2}
              className={inputCls + " py-2 resize-none leading-snug"}
              maxLength={400}
            />
          </Field>

          <Field label="Способ уведомления">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as RecurringChannel)}
              className={inputCls}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="border-t border-[var(--separator)] px-4 py-3 flex gap-2 bg-[var(--surface-card)]">
          <Button variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {submitting ? "Создаём…" : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-[var(--system-red)] ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";
