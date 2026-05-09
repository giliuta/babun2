"use client";

// STORY-056 — "Шаблоны событий" settings page. Per-user CRUD over
// public.event_templates rows. System presets are NOT shown here —
// they live as constants in lib/eventPresets.ts and always appear
// before custom rows in the EventSheet preset chip row.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronRight } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  listEventTemplates,
  createEventTemplate,
  updateEventTemplate,
  deleteEventTemplate,
  type EventTemplate,
} from "@/lib/eventTemplates";
import SheetShell from "@/components/ui/SheetShell";

const COLOR_PRESETS = [
  "#3B82F6", "#10B981", "#6366F1", "#F59E0B",
  "#EF4444", "#A855F7", "#EC4899", "#6B7280",
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180];

const PUSH_PRESETS: { label: string; value: number | null }[] = [
  { label: "Нет", value: null },
  { label: "5 мин", value: 5 },
  { label: "15 мин", value: 15 },
  { label: "30 мин", value: 30 },
  { label: "1 час", value: 60 },
  { label: "1 день", value: 1440 },
];

interface DraftTemplate {
  id: string | null;
  name: string;
  emoji: string;
  color: string;
  durationMin: number;
  pushOffsetMin: number | null;
}

const BLANK_DRAFT: DraftTemplate = {
  id: null,
  name: "",
  emoji: "",
  color: COLOR_PRESETS[0],
  durationMin: 60,
  pushOffsetMin: null,
};

export default function EventTemplatesSettingsPage() {
  const tenantId = useTenantId();
  const [items, setItems] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<DraftTemplate | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    setLoading(true);
    listEventTemplates(supabase, tenantId)
      .then((rows) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(rows);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Не удалось загрузить шаблоны";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(message);
      })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSaveDraft = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) return;
    const supabase = getSupabaseBrowser();
    try {
      if (editor.id === null) {
        const next = await createEventTemplate(supabase, tenantId, {
          name,
          emoji: editor.emoji.trim() || null,
          color: editor.color,
          durationMin: editor.durationMin,
          pushOffsetMin: editor.pushOffsetMin,
          sortOrder: items.length,
        });
        setItems((prev) => [...prev, next]);
      } else {
        const next = await updateEventTemplate(supabase, editor.id, {
          name,
          emoji: editor.emoji.trim() || null,
          color: editor.color,
          durationMin: editor.durationMin,
          pushOffsetMin: editor.pushOffsetMin,
        });
        setItems((prev) => prev.map((t) => (t.id === next.id ? next : t)));
      }
      setEditor(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка сохранения";
      setError(message);
    }
  };

  const handleDelete = async (t: EventTemplate) => {
    if (typeof window !== "undefined" && !window.confirm(`Удалить шаблон «${t.name}»?`)) {
      return;
    }
    const supabase = getSupabaseBrowser();
    try {
      await deleteEventTemplate(supabase, t.id);
      setItems((prev) => prev.filter((row) => row.id !== t.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка удаления";
      setError(message);
    }
  };

  return (
    <>
      <PageHeader title="Шаблоны событий" backHref="/dashboard/settings" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">
          <h1 className="large-title">Шаблоны событий</h1>

          <p className="text-[13px] text-[var(--label-secondary)] -mt-2">
            Свои быстрые шаблоны событий (например, «Йога 60 мин»). Появятся в форме события после системных. Видны только тебе.
          </p>

          {error && (
            <div className="px-3 py-2 rounded-[10px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] text-[var(--system-red)]">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => setEditor({ ...BLANK_DRAFT })}
            className="w-full section-card flex items-center justify-center gap-2 py-3 text-[15px] font-semibold text-[var(--accent)] active:bg-[var(--fill-tertiary)] transition press-scale"
          >
            <Plus size={16} strokeWidth={2.2} />
            Добавить шаблон
          </button>

          {loading ? (
            <div className="text-center text-[13px] text-[var(--label-secondary)] py-6">
              Загрузка…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-[13px] text-[var(--label-secondary)] py-6">
              Пока нет своих шаблонов
            </div>
          ) : (
            <div className="section-card divide-y divide-[var(--separator)]">
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setEditor({
                      id: t.id,
                      name: t.name,
                      emoji: t.emoji ?? "",
                      color: t.color,
                      durationMin: t.durationMin,
                      pushOffsetMin: t.pushOffsetMin,
                    })
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[58px] active:bg-[var(--fill-tertiary)] transition text-left"
                >
                  <span
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-[18px]"
                    style={{ background: `${t.color}1f`, color: t.color }}
                  >
                    {t.emoji ?? "•"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[var(--label)] truncate">
                      {t.name}
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
                      {formatDuration(t.durationMin)}
                      {t.pushOffsetMin !== null && (
                        <> · push за {formatPush(t.pushOffsetMin)}</>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {editor && (
        <TemplateEditorSheet
          open
          draft={editor}
          isNew={editor.id === null}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={handleSaveDraft}
          onDelete={
            editor.id !== null
              ? () => {
                  const target = items.find((t) => t.id === editor.id);
                  if (target) {
                    setEditor(null);
                    void handleDelete(target);
                  }
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function TemplateEditorSheet({
  open,
  draft,
  isNew,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  draft: DraftTemplate;
  isNew: boolean;
  onChange: (next: DraftTemplate) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const canSave = draft.name.trim().length > 0;
  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={isNew ? "Новый шаблон" : "Редактировать"}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
              canSave
                ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
                : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
            }`}
          >
            Сохранить
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-[var(--system-red)] bg-transparent active:bg-[rgba(255,59,48,0.08)]"
            >
              <Trash2 size={16} strokeWidth={2} />
              Удалить шаблон
            </button>
          )}
        </div>
      }
    >
      <div className="px-4 py-4 space-y-4 bg-[var(--surface-card)]">
        <Field label="Название">
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Например: Йога"
            maxLength={80}
            className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Field>

        <Field label="Эмодзи (необязательно)">
          <input
            type="text"
            value={draft.emoji}
            onChange={(e) => onChange({ ...draft, emoji: e.target.value })}
            placeholder="🧘"
            maxLength={4}
            className="w-20 h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[18px] text-center focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Field>

        <Field label="Цвет">
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((c) => {
              const active = c.toLowerCase() === draft.color.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...draft, color: c })}
                  aria-label={`Цвет ${c}`}
                  className={`w-9 h-9 rounded-full transition active:scale-95 ${
                    active ? "ring-2 ring-offset-2 ring-[var(--label)]" : ""
                  }`}
                  style={{ background: c }}
                />
              );
            })}
          </div>
        </Field>

        <Field label="Длительность">
          <ChipRow
            options={DURATION_PRESETS.map((m) => ({
              key: String(m),
              label: formatDuration(m),
              active: draft.durationMin === m,
              onClick: () => onChange({ ...draft, durationMin: m }),
            }))}
          />
        </Field>

        <Field label="Push-уведомление">
          <ChipRow
            options={PUSH_PRESETS.map((p) => ({
              key: p.label,
              label: p.label,
              active: draft.pushOffsetMin === p.value,
              onClick: () => onChange({ ...draft, pushOffsetMin: p.value }),
            }))}
          />
        </Field>
      </div>
    </SheetShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
}: {
  options: { key: string; label: string; active: boolean; onClick: () => void }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={o.onClick}
          className={`px-3 h-8 rounded-full text-[13px] font-medium transition active:scale-[0.97] ${
            o.active
              ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
              : "bg-[var(--fill-tertiary)] text-[var(--label)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} мин`;
  if (min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? "1 час" : `${h} ч`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ч${m}м`;
}

function formatPush(min: number): string {
  if (min < 60) return `${min} мин`;
  if (min === 60) return "1 час";
  if (min === 1440) return "1 день";
  return `${min} мин`;
}
