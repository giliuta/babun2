"use client";

import { useState, useMemo, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
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

  const handleSave = (tpl: SmsTemplate) => {
    upsertTemplate(tpl);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Удалить шаблон?")) return;
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
            className="px-3 py-1.5 bg-white text-indigo-700 lg:bg-indigo-600 lg:text-white rounded-lg text-sm font-semibold"
          >
            + Новый
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setEditing(tpl)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      {KIND_LABELS[tpl.kind]}
                    </span>
                    {!tpl.enabled && (
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        выкл.
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {tpl.body || <span className="italic text-gray-400">Пусто</span>}
                </div>
              </button>
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={tpl.enabled}
                    onChange={() => toggleEnabled(tpl.id)}
                    className="w-4 h-4"
                  />
                  Отправлять автоматически
                </label>
                <button
                  type="button"
                  onClick={() => setEditing(tpl)}
                  className="text-xs text-indigo-600 font-medium"
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
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-2xl bg-white rounded-t-2xl lg:rounded-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Шаблон</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Название</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Тип события</label>
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as TemplateKind })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Текст сообщения</label>
              <span className="text-[11px] text-gray-400">
                {smsLength} знаков • {smsCount} SMS
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={5}
              placeholder="Введите текст шаблона..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Token palette */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">
              Доступные переменные (тап для вставки)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOKENS.map(({ token, label }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 hover:bg-indigo-100"
                  title={label}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Предпросмотр</label>
            <div className="px-3 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
              {preview || <span className="italic text-gray-400">— пусто —</span>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            Отправлять автоматически
          </label>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDelete(template.id)}
            className="px-4 py-2 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg"
          >
            Удалить
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 disabled:bg-gray-300"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
