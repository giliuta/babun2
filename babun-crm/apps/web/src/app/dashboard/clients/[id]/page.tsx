"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, ClientNote, Location } from "@/lib/clients";
import { upsertClient, ACQUISITION_LABELS } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { buildMapUrl } from "@/lib/map-links";
import { formatEUR } from "@/lib/money";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import type { Appointment } from "@/lib/appointments";
import SendMessagePopup from "@/components/appointment/SendMessagePopup";

type Params = { id: string };

export default function ClientProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { clients, tags } = useClients();
  const { appointments } = useAppointments();

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

  if (!client) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-[14px] text-slate-500 mb-3">Клиент не найден</div>
        <Link
          href="/dashboard/clients"
          className="h-10 px-4 rounded-xl bg-violet-600 text-white text-[13px] font-semibold flex items-center"
        >
          ← К списку клиентов
        </Link>
      </div>
    );
  }

  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";
  const tagObjects = client.tag_ids
    .map((tid) => tags.find((t) => t.id === tid))
    .filter(Boolean) as { id: string; name: string; color: string }[];
  const activeLocations = client.locations.filter(
    (l) => l.address || l.mapUrl
  );

  const clientAppointments = appointments
    .filter((a) => a.client_id === client.id)
    .sort((a, b) => `${b.date}${b.time_start}`.localeCompare(`${a.date}${a.time_start}`));

  const update = (patch: Partial<Client>) =>
    upsertClient({ ...client, ...patch });

  const addNote = () => {
    const txt = newNote.trim();
    if (!txt) return;
    const note: ClientNote = {
      id: generateId("note"),
      text: txt,
      created_at: new Date().toISOString(),
    };
    update({ notes: [note, ...client.notes] });
    setNewNote("");
  };

  const deleteNote = (noteId: string) => {
    update({ notes: client.notes.filter((n) => n.id !== noteId) });
  };

  const toggleTag = (tagId: string) => {
    const has = client.tag_ids.includes(tagId);
    update({
      tag_ids: has
        ? client.tag_ids.filter((t) => t !== tagId)
        : [...client.tag_ids, tagId],
    });
  };

  const grouped = groupAppointmentsByLocation(clientAppointments, activeLocations);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 px-3 h-12">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Назад"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 active:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 text-[14px] font-semibold text-slate-900 truncate">
            Клиент
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Меню"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-2 space-y-2 pb-24">
          {/* Header card: name / phone / comment — tight */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <EditableName value={client.full_name} onSave={(v) => update({ full_name: v })} />
            <EditablePhone
              value={client.phone}
              digits={phoneDigits}
              onSave={(v) => update({ phone: v })}
            />
            <EditableComment
              value={client.comment}
              onSave={(v) => update({ comment: v })}
            />
          </div>

          {/* Tags + discount */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => {
                const active = client.tag_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className="h-7 px-2.5 rounded-full text-[11px] font-semibold border transition"
                    style={
                      active
                        ? {
                            backgroundColor: `${t.color}22`,
                            borderColor: t.color,
                            color: t.color,
                          }
                        : {
                            backgroundColor: "white",
                            borderColor: "rgb(226 232 240)",
                            color: "rgb(100 116 139)",
                          }
                    }
                  >
                    {active && "✓ "}
                    {t.name}
                  </button>
                );
              })}
              {tagObjects.length === 0 && (
                <span className="text-[11px] text-slate-400">Нет тегов</span>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-slate-600">Постоянная скидка</span>
              <EditableDiscount
                value={client.discount}
                onSave={(v) => update({ discount: v })}
              />
            </div>
          </div>

          {/* Objects */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Объекты ({activeLocations.length})
            </div>
            {activeLocations.length === 0 ? (
              <div className="px-4 py-4 text-[12px] text-slate-400">
                Нет сохранённых адресов. Будут появляться по мере создания записей.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeLocations.map((loc) => (
                  <ObjectRow key={loc.id} location={loc} />
                ))}
              </div>
            )}
          </div>

          {/* Appointment history grouped by object (collapsed by default) */}
          <CollapsibleCard title={`История записей · ${clientAppointments.length}`}>
            {clientAppointments.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400">
                Записей пока нет.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {grouped.map((group) => (
                  <div key={group.key} className="py-1">
                    <div className="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold text-slate-500 truncate">
                      {group.title}
                    </div>
                    <div>
                      {group.appointments.map((apt) => (
                        <AppointmentRow key={apt.id} apt={apt} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleCard>

          {/* Notes (collapsed by default) */}
          <CollapsibleCard title={`Заметки · ${client.notes.length}`}>
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  id="client-note-input"
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Написать заметку…"
                  className="flex-1 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="h-9 px-3 rounded-lg bg-violet-600 text-white text-[12px] font-semibold active:scale-[0.98] disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
              {client.notes.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">Пусто</div>
              ) : (
                <div className="space-y-1.5">
                  {client.notes.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200"
                    >
                    <div className="flex-1 text-[12px] text-amber-900 whitespace-pre-wrap">
                      <span className="text-[10px] text-amber-600 mr-1 tabular-nums">
                        {formatShortDate(n.created_at)}
                      </span>
                      {n.text}
                    </div>
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        aria-label="Удалить"
                        className="w-6 h-6 flex items-center justify-center rounded text-amber-400 active:text-rose-500"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleCard>

          {/* Info: source, birthday, email, created (collapsed by default) */}
          <CollapsibleCard title="Инфо">
            <div className="p-3 space-y-2">
              <InfoRow label="Источник">
                <select
                  value={client.acquisition_source}
                  onChange={(e) =>
                    update({
                      acquisition_source: e.target.value as typeof client.acquisition_source,
                    })
                  }
                  className="flex-1 h-8 px-2 text-[12px] text-right bg-transparent focus:outline-none text-slate-900"
                >
                  {(Object.keys(ACQUISITION_LABELS) as (keyof typeof ACQUISITION_LABELS)[]).map((k) => (
                    <option key={k} value={k}>
                      {ACQUISITION_LABELS[k]}
                    </option>
                  ))}
                </select>
              </InfoRow>
              <InfoRow label="День рождения">
                <input
                  type="date"
                  value={client.birthday}
                  onChange={(e) => update({ birthday: e.target.value })}
                  className="flex-1 h-8 px-2 text-[12px] text-right bg-transparent focus:outline-none text-slate-900 tabular-nums"
                />
              </InfoRow>
              <InfoRow label="E-mail">
                <EditableInline
                  value={client.email}
                  placeholder="email@example.com"
                  onSave={(v) => update({ email: v })}
                />
              </InfoRow>
              <InfoRow label="Создан">
                <span className="text-[12px] text-slate-500 tabular-nums">
                  {formatShortDate(client.created_at)}
                </span>
              </InfoRow>
            </div>
          </CollapsibleCard>
        </div>
      </div>

      {/* ⋯ menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-5"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              {client.full_name}
            </div>
            <MenuItem
              icon="💬"
              label="Отправить сообщение"
              onClick={() => {
                setMenuOpen(false);
                setSendMsgOpen(true);
              }}
            />
            <MenuItem
              icon="💭"
              label="Перейти в чат"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/dashboard/chats?client_id=${client.id}`);
              }}
            />
            <MenuItem
              icon="🔗"
              label="Поделиться контактом"
              onClick={async () => {
                setMenuOpen(false);
                const text = [client.full_name, client.phone].filter(Boolean).join(" · ");
                if (typeof navigator !== "undefined" && navigator.share) {
                  try {
                    await navigator.share({ title: client.full_name, text });
                  } catch {
                    // user dismissed
                  }
                } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(text);
                }
              }}
            />
            <MenuItem
              icon="📝"
              label="Добавить заметку"
              onClick={() => {
                setMenuOpen(false);
                const el = document.getElementById("client-note-input");
                el?.focus();
              }}
            />
            <MenuItem
              icon={client.blacklisted ? "✅" : "🚫"}
              label={client.blacklisted ? "Убрать из ЧС" : "В чёрный список"}
              onClick={() => update({ blacklisted: !client.blacklisted })}
              danger={!client.blacklisted}
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 text-[13px] font-medium text-slate-500 border-t border-slate-100 active:bg-slate-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <SendMessagePopup
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        phone={client.phone ?? null}
        clientName={client.full_name}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 border-b border-slate-50 last:border-0"
    >
      <span className="text-[18px] w-6 text-center">{icon}</span>
      <span
        className={`text-[14px] font-medium flex-1 ${
          danger ? "text-rose-600" : "text-slate-900"
        }`}
      >
        {label}
      </span>
      <span className="text-slate-300">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}

function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 h-10 active:bg-slate-50"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <span
          className={`text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

function EditableName({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) onSave(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full h-10 text-[20px] font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="w-full text-left text-[20px] font-bold text-slate-900 active:opacity-60"
    >
      {value || <span className="text-slate-400">Без имени</span>}
    </button>
  );
}

function EditablePhone({
  value,
  digits,
  onSave,
}: {
  value: string;
  digits: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <div className="flex items-center gap-2 mt-1">
      {editing ? (
        <input
          autoFocus
          type="tel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 h-9 text-[14px] tabular-nums bg-slate-50 border border-slate-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="flex-1 text-left text-[14px] text-slate-600 tabular-nums active:opacity-60"
        >
          {value || <span className="text-slate-400">Без телефона</span>}
        </button>
      )}
      {digits && !editing && (
        <a
          href={`tel:${digits}`}
          aria-label="Позвонить"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-emerald-600 bg-emerald-50 active:bg-emerald-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </a>
      )}
    </div>
  );
}

function EditableComment({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setEditing(false);
        }}
        rows={2}
        placeholder="Комментарий о клиенте…"
        className="w-full mt-2 p-2 text-[12px] text-slate-700 bg-amber-50 border border-amber-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="mt-2 w-full text-left text-[12px] text-slate-600 active:opacity-60"
    >
      {value ? (
        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 whitespace-pre-wrap">
          💬 {value}
        </div>
      ) : (
        <span className="text-slate-400">+ Комментарий о клиенте</span>
      )}
    </button>
  );
}

function EditableDiscount({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => {
          const v = Number(draft);
          onSave(Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-16 h-8 text-[13px] text-right tabular-nums bg-slate-50 border border-slate-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="text-[13px] font-semibold text-slate-900 tabular-nums active:opacity-60"
    >
      {value}%
    </button>
  );
}

function EditableInline({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className="flex-1 h-8 px-2 text-[12px] text-right bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="flex-1 h-8 text-right text-[12px] active:opacity-60 text-slate-700 truncate"
    >
      {value || <span className="text-slate-400">{placeholder || "—"}</span>}
    </button>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-slate-500 flex-shrink-0">{label}</span>
      <span className="flex-1 flex justify-end">{children}</span>
    </div>
  );
}

function ObjectRow({ location }: { location: Location }) {
  const openMaps = () => {
    const url = buildMapUrl("google", location.mapUrl || location.address);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="px-4 py-2.5 flex items-center gap-2">
      <span className="flex-shrink-0 text-rose-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {location.label || "Объект"}
          {location.isPrimary && (
            <span className="text-[10px] text-violet-600 ml-1 font-normal">· основной</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 truncate">
          {location.address || "Google Maps ссылка"}
        </div>
      </div>
      <button
        type="button"
        onClick={openMaps}
        aria-label="Навигация"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-sky-600 bg-sky-50 active:bg-sky-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </button>
    </div>
  );
}

function AppointmentRow({ apt }: { apt: Appointment }) {
  const statusBadge = (() => {
    if (apt.status === "completed")
      return { text: "Выполнено", color: "bg-emerald-100 text-emerald-700" };
    if (apt.status === "cancelled")
      return { text: "Отменено", color: "bg-slate-100 text-slate-500" };
    if (apt.status === "in_progress")
      return { text: "В работе", color: "bg-amber-100 text-amber-700" };
    return { text: "Запланировано", color: "bg-sky-100 text-sky-700" };
  })();

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-slate-900 truncate">
          {apt.comment || "—"}
        </div>
        <div className="text-[10px] text-slate-500 tabular-nums">
          {formatAptDate(apt.date)} · {apt.time_start}
        </div>
      </div>
      <span
        className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.color}`}
      >
        {statusBadge.text}
      </span>
      <span className="flex-shrink-0 text-[12px] font-bold text-emerald-700 tabular-nums w-14 text-right">
        {formatEUR(apt.total_amount)}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatAptDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (!Number.isFinite(date.getTime())) return ymd;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface AppointmentGroup {
  key: string;
  title: string;
  appointments: Appointment[];
}

function groupAppointmentsByLocation(
  appointments: Appointment[],
  locations: Location[]
): AppointmentGroup[] {
  if (appointments.length === 0) return [];
  const byLocation = new Map<string, Appointment[]>();
  for (const apt of appointments) {
    const key = apt.location_id ?? "__none__";
    const arr = byLocation.get(key) ?? [];
    arr.push(apt);
    byLocation.set(key, arr);
  }
  const out: AppointmentGroup[] = [];
  for (const loc of locations) {
    const arr = byLocation.get(loc.id);
    if (arr && arr.length > 0) {
      out.push({
        key: loc.id,
        title: `${loc.label || "Объект"} — ${loc.address || "Без адреса"}`,
        appointments: arr,
      });
    }
  }
  const orphan = byLocation.get("__none__");
  if (orphan && orphan.length > 0) {
    out.push({
      key: "__none__",
      title: "Без привязки к объекту",
      appointments: orphan,
    });
  }
  return out;
}
