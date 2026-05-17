"use client";

import { useState, useMemo, useRef } from "react";
import { MessageSquare, X } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/Toast";
import { Button, Input } from "@/components/ui";
import { useSmsTemplates } from "@/components/layout/DashboardClientLayout";
import {
  KIND_LABELS,
  AVAILABLE_TOKENS,
  renderTemplate,
  createBlankTemplate,
  type SmsTemplate,
  type TemplateKind,
} from "@babun/shared/local/sms-templates";
// v547 §3.10 — proper GSM-7 vs UCS-2 segment math so the editor
// tells the truth about per-SMS bill (Cyrillic → 70 chars, Latin →
// 160). 6 vitest cases cover the math.
import { analyzeSmsEncoding } from "@babun/shared/local/sms-encoding";
import { getSmsPresets, type SmsPreset } from "@babun/shared/local/sms-presets";

// P2 #40 (CRM Core brief) — starter templates surfaced in the empty
// state. Each one creates a draft that opens straight into the
// editor, so the operator sees how variables look in practice instead
// of staring at a blank textarea. Bodies use the new Russian token
// palette (P2 #41), which renderTemplate aliases back to canonical
// English keys for substitution.
const STARTER_PRESETS: ReadonlyArray<{
  id: string;
  kind: TemplateKind;
  name: string;
  body: string;
}> = [
  {
    id: "preset-reminder",
    kind: "reminder",
    name: "Напоминание за 24ч",
    body:
      "[Имя], напоминаем: завтра в [Время] — [Услуга]. Адрес: [Адрес]. " +
      "Если планы изменились, ответьте на это сообщение. — [Компания]",
  },
  {
    id: "preset-confirm",
    kind: "new_appointment",
    name: "Подтверждение записи",
    body:
      "[Имя], запись подтверждена: [Дата], [Время]. Мастер — [Мастер]. " +
      "Адрес: [Адрес]. — [Компания]",
  },
  {
    id: "preset-feedback",
    kind: "after_24h_short",
    name: "Запрос отзыва",
    body:
      "[Имя], спасибо что выбрали нас. Поделитесь впечатлением — это " +
      "займёт минуту: [СсылкаНаОтмену]. — [Компания]",
  },
  {
    id: "preset-birthday",
    kind: "after_24h_long",
    name: "Поздравление с днём рождения",
    body:
      "[Имя], с днём рождения! В этом месяце скидка на сервис от " +
      "[Компания]. Бронируйте по этой ссылке: [СсылкаНаОтмену].",
  },
];

// Keyed by canonical English names — renderTemplate's alias table
// maps Russian palette tokens like [Имя] / [Цена] back onto these
// entries, so we don't need to mirror the dictionary into Cyrillic.
const SAMPLE_VARS: Record<string, string> = {
  Name: "Анастасия",
  Day: "Пятница",
  Date: "12.04.2026",
  Time: "10:00",
  Master: "Y&D",
  Service: "x4 A/C Чистка",
  Address: "Лимассол",
  Price: "€80",
  Company: "AirFix",
  CancelUrl: "babun.app/c/abc",
};

export default function SmsTemplatesPage() {
  const { templates, setTemplates, upsertTemplate } = useSmsTemplates();
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  // P2 #39 (CRM Core brief) — «Удалить» belongs to edit mode only.
  // Drafts from createBlankTemplate() carry an id that's not yet in
  // the saved list; we use that to detect «create» vs «edit» and pass
  // it to the editor so the destructive button stays hidden until
  // there's actually something to delete.
  const isCreating = editing
    ? !templates.some((t) => t.id === editing.id)
    : false;

  const handleSave = (tpl: SmsTemplate) => {
    upsertTemplate(tpl);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Удалить шаблон?" }))) return;
    setTemplates(templates.filter((t) => t.id !== id));
    setEditing(null);
  };

  const handleNew = () => {
    setEditing(createBlankTemplate());
  };

  // Open the editor with a starter preset pre-filled. We mint a fresh
  // id via createBlankTemplate so isCreating === true and «Удалить»
  // stays hidden until the user actually saves the draft.
  const handlePreset = (preset: (typeof STARTER_PRESETS)[number]) => {
    const draft = createBlankTemplate(preset.kind);
    setEditing({ ...draft, name: preset.name, body: preset.body });
  };

  const toggleEnabled = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    upsertTemplate({ ...tpl, enabled: !tpl.enabled });
  };

  return (
    <>
      <PageHeader
        title="SMS-шаблоны"
        subtitle={`${templates.length} шаблонов`}
        rightContent={
          <button
            type="button"
            onClick={handleNew}
            className="px-3 py-1.5 text-[var(--accent)] rounded-[10px] text-[13px] font-semibold active:opacity-70"
          >
            + Новый
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-3">
          {templates.length === 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={18} strokeWidth={2} className="text-[var(--accent)]" />
                <h2 className="text-[15px] font-semibold text-[var(--label)]">
                  Шаблонов пока нет
                </h2>
              </div>
              <p className="text-[13px] text-[var(--label-secondary)] mb-4 leading-snug">
                Начните с готового — потом подкрутите текст под себя.
              </p>
              <div className="space-y-2">
                {STARTER_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[12px] bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)] text-left transition"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--label)] truncate">
                        {p.name}
                      </div>
                      <div className="text-[12px] text-[var(--label-secondary)] truncate">
                        {KIND_LABELS[p.kind]}
                      </div>
                    </div>
                    <span className="text-[12px] text-[var(--accent)] font-semibold shrink-0">
                      Использовать →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setEditing(tpl)}
                className="w-full px-4 py-3 text-left active:bg-[var(--fill-quaternary)]"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                      {KIND_LABELS[tpl.kind]}
                    </span>
                    {!tpl.enabled && (
                      <span className="text-[12px] bg-[var(--fill-tertiary)] text-[var(--label-secondary)] px-2 py-0.5 rounded">
                        выкл.
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[15px] font-medium text-[var(--label)]">{tpl.name}</div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-1 line-clamp-2">
                  {tpl.body || <span className="italic text-[var(--label-tertiary)]">Пусто</span>}
                </div>
              </button>
              <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--separator)] bg-[var(--surface-grouped)]">
                <label className="flex items-center gap-2 text-[12px] text-[var(--label-secondary)]">
                  <input
                    type="checkbox"
                    checked={tpl.enabled}
                    onChange={() => toggleEnabled(tpl.id)}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                  Отправлять автоматически
                </label>
                <button
                  type="button"
                  onClick={() => setEditing(tpl)}
                  className="text-[12px] text-[var(--accent)] font-medium"
                >
                  Редактировать →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <TemplateEditor
          template={editing}
          mode={isCreating ? "create" : "edit"}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

function TemplateEditor({
  template,
  mode,
  onClose,
  onSave,
  onDelete,
}: {
  template: SmsTemplate;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (tpl: SmsTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<SmsTemplate>(template);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const preview = useMemo(() => renderTemplate(draft.body, SAMPLE_VARS), [draft.body]);
  // v547 §3.10 — analyze the RENDERED preview (with sample client data
  // substituted) because that's what the carrier actually charges
  // for. Body «[Имя]» is 5 GSM-7 chars / 1 segment, but rendered as
  // «Анастасия» it's 9 UCS-2 chars / still 1 segment but into the
  // 70-char bucket. Counting the raw body would under-report cost.
  const encInfo = useMemo(() => analyzeSmsEncoding(preview), [preview]);
  const smsLength = encInfo.length;
  const smsCount = encInfo.segments;
  // v547 §3.10 — per-kind preset chips. Surfaced as «Применить»
  // tiles below the body textarea, but only when the body is still
  // blank so we never silently clobber the user's draft. Re-renders
  // the moment the user picks a different kind from the dropdown.
  const presets = useMemo(() => getSmsPresets(draft.kind), [draft.kind]);

  const applyPreset = (preset: SmsPreset) => {
    setDraft((d) => ({
      ...d,
      // Auto-fill name only when blank — preserves the user's typing.
      name: d.name.trim() ? d.name : preset.name,
      body: preset.body,
    }));
    // After applying, refocus the textarea so the user can continue
    // editing without a tap.
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((d) => ({ ...d, body: d.body + token }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((d) => ({ ...d, body: next }));
    // Restore cursor after the token
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2">
      <div className="w-full lg:max-w-2xl bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">Шаблон</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center transition"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--surface-grouped)]">
          <Input
            label="Название"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />

          <div>
            <div className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
              Тип события
            </div>
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as TemplateKind })}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            >
              {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[var(--label-secondary)] tracking-wide">
                Текст сообщения
              </label>
              <span
                className={`text-[12px] tabular-nums ${
                  encInfo.segments > 1
                    ? "text-[var(--system-orange)] font-semibold"
                    : "text-[var(--label-tertiary)]"
                }`}
                title={
                  encInfo.encoding === "ucs2"
                    ? "Кириллица или эмодзи — 70 знаков на SMS (а не 160)."
                    : "Латиница — 160 знаков на SMS."
                }
                data-testid="sms-counter"
              >
                {smsLength} знаков · {smsCount} SMS
                {encInfo.encoding === "ucs2" ? " · UCS-2" : ""}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={5}
              placeholder="Введите текст шаблона..."
              className="w-full px-3.5 py-2.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] resize-none transition"
            />
            {/* v547 §3.10 — when a Cyrillic body silently jumps to 2+
                segments, surface the cost explicitly so the dispatcher
                knows trimming ~10 chars halves their SMS bill on
                every send. */}
            {encInfo.segments > 1 && (
              <div className="mt-1.5 text-[11px] text-[var(--system-orange)] leading-snug">
                Сообщение разобьётся на {encInfo.segments} SMS. Чтобы
                уложиться в одну — сократите до {encInfo.singleLimit}{" "}
                знаков
                {encInfo.encoding === "ucs2" ? " (кириллица)" : ""}.
              </div>
            )}
          </div>

          {/* v547 §3.10 — preset library. Per-kind starter templates.
              Only shows when body is empty so we never clobber a
              draft the user already started. */}
          {presets.length > 0 && !draft.body.trim() && (
            <div>
              <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-2 tracking-wide">
                Готовые шаблоны для «{KIND_LABELS[draft.kind]}»
              </label>
              <div className="flex flex-col gap-2">
                {presets.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    data-testid={`sms-preset-${draft.kind}-${i}`}
                    className="text-left px-3 py-2.5 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] active:bg-[var(--fill-quaternary)] transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-[var(--label)]">
                        {preset.label}
                      </span>
                      <span className="text-[11px] text-[var(--accent)] font-medium shrink-0">
                        Применить →
                      </span>
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)] leading-snug line-clamp-2">
                      {preset.body}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token palette */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-2 tracking-wide">
              Доступные переменные (нажмите, чтобы вставить)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOKENS.map(({ token, label }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="px-3 py-1.5 text-[12px] bg-[var(--accent-tint)] text-[var(--accent)] rounded-full font-medium active:opacity-70 transition"
                  title={label}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
              Предпросмотр
            </label>
            <div className="px-3 py-3 bg-[rgba(52,199,89,0.08)] border border-[rgba(52,199,89,0.2)] rounded-[10px] text-[15px] text-[var(--label)] whitespace-pre-wrap">
              {preview || <span className="italic text-[var(--label-tertiary)]">— пусто —</span>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[15px] text-[var(--label)]">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            Отправлять автоматически
          </label>
        </div>

        <div className="border-t border-[var(--separator)] px-4 py-3 flex gap-2 bg-[var(--surface-card)]">
          {mode === "edit" && (
            <Button
              variant="destructive"
              size="md"
              onClick={() => onDelete(template.id)}
            >
              Удалить
            </Button>
          )}
          {/* P2 #42 (CRM Core brief) — «Отправить тест». Prompts for
              a phone, sends the rendered preview to it via the
              /api/sms/test wrapper. Costs 1 SMS off the tenant
              balance per the edge function. */}
          <Button
            variant="secondary"
            size="md"
            onClick={async () => {
              const phone = window.prompt(
                "Номер для теста (+357...)",
                "",
              );
              if (!phone || !phone.trim()) return;
              const res = await fetch("/api/sms/test", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  to_phone: phone.trim(),
                  body: preview,
                }),
              });
              if (res.ok) {
                toast.show({
                  variant: "success",
                  message: "Тест отправлен. С баланса списан 1 SMS.",
                });
              } else {
                let err = "";
                try {
                  const j = await res.json();
                  err = j.error ?? j.hint ?? "";
                } catch {
                  err = String(res.status);
                }
                toast.show({
                  variant: "error",
                  message: `Ошибка: ${err || res.statusText}`,
                });
              }
            }}
            disabled={!draft.body.trim()}
          >
            Тест
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
