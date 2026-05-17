"use client";

// Beta #50 (CRM Core brief) — minimal CRUD UI for the webhooks
// table created in migration 20260517_003.
//
// Scope today:
//   • List tenant's webhook rows (label / URL / event mask / on-off).
//   • Add new row via inline form.
//   • Toggle enabled state.
//   • Delete with confirm.
//   • Reveal-on-tap of the HMAC secret so the developer can copy it
//     into their endpoint config without leaving the page.
//
// The actual dispatcher (POST → URL with HMAC header on events like
// `appointment.completed`) is the next-iteration edge function;
// having the table populated lets us point that function at real
// targets the moment it ships.

import { useEffect, useState } from "react";
import { Plus, Trash2, Webhook, Copy, Eye, EyeOff } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { haptic } from "@/lib/haptics";

interface WebhookRow {
  id: string;
  label: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  last_fired_at: string | null;
  last_status: number | null;
}

const AVAILABLE_EVENTS = [
  { value: "appointment.created", label: "Новая запись" },
  { value: "appointment.completed", label: "Запись завершена" },
  { value: "appointment.cancelled", label: "Запись отменена" },
  { value: "client.created", label: "Новый клиент" },
  { value: "payment.received", label: "Получена оплата" },
];

interface Props {
  tenantId: string;
}

export default function WebhooksCard({ tenantId }: Props) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Inline-add form state.
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftEvents, setDraftEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("webhooks")
        .select("id,label,url,secret,events,enabled,last_fired_at,last_status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      setRows(
        ((data as unknown as WebhookRow[]) ?? []).map((r) => ({
          ...r,
          events: Array.isArray(r.events) ? r.events : [],
        })),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleAdd = async () => {
    if (!draftLabel.trim() || !draftUrl.trim() || draftEvents.length === 0) {
      return;
    }
    if (!/^https:\/\//i.test(draftUrl.trim())) {
      window.alert("URL должен быть https://…");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("webhooks").insert({
        tenant_id: tenantId,
        label: draftLabel.trim(),
        url: draftUrl.trim(),
        events: draftEvents,
        enabled: true,
      });
      haptic("success");
      setDraftLabel("");
      setDraftUrl("");
      setDraftEvents([]);
      setAdding(false);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (row: WebhookRow) => {
    haptic("tap");
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)),
    );
    const supabase = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("webhooks")
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
  };

  const handleDelete = async (row: WebhookRow) => {
    if (!(await confirm({ title: `Удалить «${row.label}»?` }))) return;
    haptic("warning");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const supabase = getSupabaseBrowser();
    await supabase.from("webhooks").delete().eq("id", row.id);
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      haptic("success");
    } catch {
      // ignore — clipboard unavailable
    }
  };

  const toggleEvent = (event: string) => {
    setDraftEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  };

  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="flex-shrink-0 w-11 h-11 rounded-[12px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
          <Webhook size={20} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[var(--label)]">
            Webhooks
          </div>
          <div className="text-[13px] text-[var(--label-secondary)] leading-snug">
            POST на ваш URL при событиях в Babun. HMAC-SHA256 подпись в заголовке
            `X-Babun-Signature` для проверки подлинности.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--label-tertiary)] py-2">
          Загрузка…
        </div>
      ) : rows.length === 0 && !adding ? (
        <div className="text-[12px] text-[var(--label-tertiary)] py-2">
          Webhook'ов пока нет.
        </div>
      ) : (
        <ul className="space-y-2 mb-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="p-3 rounded-[12px] bg-[var(--fill-quaternary)] space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--label)] truncate">
                    {row.label}
                  </div>
                  <div className="text-[11px] text-[var(--label-secondary)] truncate tabular-nums">
                    {row.url}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--label-secondary)] shrink-0">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={() => handleToggle(row)}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                  {row.enabled ? "вкл." : "выкл."}
                </label>
                <button
                  type="button"
                  onClick={() => void handleDelete(row)}
                  aria-label="Удалить"
                  className="w-7 h-7 rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)] flex items-center justify-center"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.events.length === 0 ? (
                  <span className="text-[10px] text-[var(--label-tertiary)] italic">
                    нет подписок
                  </span>
                ) : (
                  row.events.map((e) => (
                    <span
                      key={e}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-tint)] text-[var(--accent)]"
                    >
                      {e}
                    </span>
                  ))
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--label-tertiary)]">
                <button
                  type="button"
                  onClick={() =>
                    setRevealedSecret(
                      revealedSecret === row.id ? null : row.id,
                    )
                  }
                  className="inline-flex items-center gap-1 text-[var(--accent)] active:opacity-70"
                >
                  {revealedSecret === row.id ? (
                    <>
                      <EyeOff size={11} strokeWidth={2} />
                      Скрыть секрет
                    </>
                  ) : (
                    <>
                      <Eye size={11} strokeWidth={2} />
                      Показать секрет
                    </>
                  )}
                </button>
                {revealedSecret === row.id && (
                  <>
                    <code className="flex-1 min-w-0 truncate text-[10px] tabular-nums text-[var(--label)] font-mono">
                      {row.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copySecret(row.secret)}
                      aria-label="Копировать"
                      className="w-6 h-6 rounded text-[var(--accent)] active:bg-[var(--accent-tint)] flex items-center justify-center"
                    >
                      <Copy size={11} strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-10 flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--separator)] text-[var(--accent)] text-[13px] font-semibold active:bg-[var(--accent-tint)]"
        >
          <Plus size={13} strokeWidth={2.5} />
          Добавить webhook
        </button>
      ) : (
        <div className="p-3 rounded-[12px] bg-[var(--fill-quaternary)] space-y-2">
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Название (например: «Zapier»)"
            className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[14px]"
            maxLength={60}
          />
          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://your-endpoint.example.com/babun"
            className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[13px] tabular-nums"
            maxLength={500}
          />
          <div>
            <div className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1">
              Подписки
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_EVENTS.map((e) => {
                const active = draftEvents.includes(e.value);
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => toggleEvent(e.value)}
                    className={`h-8 px-2.5 rounded-full text-[11px] font-semibold transition ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--surface-card)] text-[var(--label-secondary)] border border-[var(--separator)]"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraftLabel("");
                setDraftUrl("");
                setDraftEvents([]);
              }}
              className="flex-1 h-10 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[13px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={
                submitting ||
                !draftLabel.trim() ||
                !draftUrl.trim() ||
                draftEvents.length === 0
              }
              className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
            >
              {submitting ? "Сохраняем…" : "Создать"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
