"use client";

import { useState, useMemo, useRef } from "react";
import { X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Button, Input } from "@/components/ui";
import { useSmsTemplates } from "@/app/dashboard/layout";
import {
  KIND_LABELS,
  AVAILABLE_TOKENS,
  renderTemplate,
  createBlankTemplate,
  type SmsTemplate,
  type TemplateKind,
} from "@/lib/sms-templates";

const SAMPLE_VARS: Record<string, string> = {
  Name: "Анастасия",
  Day: "Пятница",
  Date: "12.04.2026",
  Time: "10:00",
  Master: "Y&D",
  Service: "x4 A/C Чистка",
  Address: "Лимассол",
};

export default function SmsTemplatesPage() {
  const { templates, setTemplates, upsertTemplate } = useSmsTemplates();
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const confirm = useConfirm();

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
            className="px-3 py-1.5 bg-[var(--surface-card)] text-[var(--accent)] lg:bg-[var(--accent)] lg:text-[var(--label-on-accent)] rounded-[10px] text-[13px] font-semibold"
          >
            + Новый
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-3">
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
  onClose,
  onSave,
  onDelete,
}: {
  template: SmsTemplate;
  onClose: () => void;
  onSave: (tpl: SmsTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<SmsTemplate>(template);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(() => renderTemplate(draft.body, SAMPLE_VARS), [draft.body]);
  const smsLength = preview.length;
  const smsCount = Math.ceil(smsLength / 160) || 1;

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
              <span className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
                {smsLength} знаков · {smsCount} SMS
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
          </div>

          {/* Token palette */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-2 tracking-wide">
              Доступные переменные (тап для вставки)
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
          <Button
            variant="destructive"
            size="md"
            onClick={() => onDelete(template.id)}
          >
            Удалить
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
