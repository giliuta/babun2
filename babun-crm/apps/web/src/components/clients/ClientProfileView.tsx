"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  MapPin,
  ArrowUpRight,
  Phone as PhoneIcon,
  Check,
  X,
  MessageSquare,
  MessageCircle,
  Share2,
  StickyNote,
  Ban,
  CheckCircle2,
} from "@babun/shared/icons";
import type { Client, ClientNote, Location } from "@babun/shared/local/clients";
import { upsertClient, ACQUISITION_LABELS } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import { formatEUR } from "@babun/shared/common/utils/money";
import { useClients, useAppointments } from "@/components/layout/DashboardClientLayout";
import type { Appointment } from "@babun/shared/local/appointments";
import SendMessagePopup from "@/components/appointment/SendMessagePopup";
import { Button } from "@/components/ui";

interface ClientProfileViewProps {
  clientId: string;
  /** Called when the user taps the back arrow. The caller decides
   *  whether to pop history (for the routed page) or just close the
   *  overlay (when embedded inside another sheet). */
  onBack: () => void;
}

export default function ClientProfileView({
  clientId,
  onBack,
}: ClientProfileViewProps) {
  const router = useRouter();
  const { clients, tags } = useClients();
  const { appointments } = useAppointments();

  const client = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

  if (!client) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--surface-grouped)] p-6">
        <div className="text-[14px] text-[var(--label-secondary)] mb-3">Клиент не найден</div>
        <Link
          href="/dashboard/clients"
          className="h-10 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold flex items-center active:bg-[var(--accent-pressed)]"
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
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-grouped)] h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <div className="flex items-center gap-2 px-3 h-12">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 text-[14px] font-semibold text-[var(--label)] truncate">
            Клиент
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Меню"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <MoreHorizontal size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-2 space-y-2 pb-24">
          {/* Header card: name / phone / comment — tight */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3">
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
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => {
                const active = client.tag_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className="h-7 px-2.5 rounded-full text-[12px] font-semibold border transition inline-flex items-center gap-1"
                    style={
                      active
                        ? {
                            backgroundColor: `${t.color}22`,
                            borderColor: t.color,
                            color: t.color,
                          }
                        : {
                            backgroundColor: "var(--surface-card)",
                            borderColor: "var(--separator)",
                            color: "var(--label-secondary)",
                          }
                    }
                  >
                    {active && <Check size={11} strokeWidth={2.5} />}
                    {t.name}
                  </button>
                );
              })}
              {tagObjects.length === 0 && (
                <span className="text-[12px] text-[var(--label-tertiary)]">Нет тегов</span>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-[var(--label-secondary)]">Постоянная скидка</span>
              <EditableDiscount
                value={client.discount}
                onSave={(v) => update({ discount: v })}
              />
            </div>
          </div>

          {/* Objects */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              Объекты ({activeLocations.length})
            </div>
            {activeLocations.length === 0 ? (
              <div className="px-4 py-4 text-[13px] text-[var(--label-tertiary)]">
                Нет сохранённых адресов. Будут появляться по мере создания записей.
              </div>
            ) : (
              <div className="divide-y divide-[var(--separator)]">
                {activeLocations.map((loc) => (
                  <ObjectRow key={loc.id} location={loc} />
                ))}
              </div>
            )}
          </div>

          {/* Appointment history grouped by object (collapsed by default) */}
          <CollapsibleCard title={`История записей · ${clientAppointments.length}`}>
            {clientAppointments.length === 0 ? (
              <div className="px-3 py-3 text-[13px] text-[var(--label-tertiary)]">
                Записей пока нет.
              </div>
            ) : (
              <div className="divide-y divide-[var(--separator)]">
                {grouped.map((group) => (
                  <div key={group.key} className="py-1">
                    <div className="px-3 pt-1.5 pb-0.5 text-[12px] font-semibold text-[var(--label-secondary)] truncate">
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
                  className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                >
                  Добавить
                </Button>
              </div>
              {client.notes.length === 0 ? (
                <div className="text-[12px] text-[var(--label-tertiary)] italic">Пусто</div>
              ) : (
                <div className="space-y-1.5">
                  {client.notes.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.25)]"
                    >
                      <div className="flex-1 text-[13px] text-[var(--system-orange)] whitespace-pre-wrap">
                        <span className="text-[12px] text-[var(--system-orange)] mr-1 tabular-nums">
                          {formatShortDate(n.created_at)}
                        </span>
                        {n.text}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        aria-label="Удалить"
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--system-orange)] active:text-[var(--system-red)]"
                      >
                        <X size={12} strokeWidth={2.5} />
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
                  className="flex-1 h-8 px-2 text-[13px] text-right bg-transparent focus:outline-none text-[var(--label)]"
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
                  className="flex-1 h-8 px-2 text-[13px] text-right bg-transparent focus:outline-none text-[var(--label)] tabular-nums"
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
                <span className="text-[13px] text-[var(--label-secondary)] tabular-nums">
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--separator)] text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
              {client.full_name}
            </div>
            <MenuItem
              icon={MessageSquare}
              label="Отправить сообщение"
              onClick={() => {
                setMenuOpen(false);
                setSendMsgOpen(true);
              }}
            />
            <MenuItem
              icon={MessageCircle}
              label="Перейти в чат"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/dashboard/chats?client_id=${client.id}`);
              }}
            />
            <MenuItem
              icon={Share2}
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
              icon={StickyNote}
              label="Добавить заметку"
              onClick={() => {
                setMenuOpen(false);
                const el = document.getElementById("client-note-input");
                el?.focus();
              }}
            />
            <MenuItem
              icon={client.blacklisted ? CheckCircle2 : Ban}
              label={client.blacklisted ? "Убрать из ЧС" : "В чёрный список"}
              onClick={() => update({ blacklisted: !client.blacklisted })}
              danger={!client.blacklisted}
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
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
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--fill-quaternary)] border-b border-[var(--separator)] last:border-0"
    >
      <span
        className={`w-6 flex items-center justify-center ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label-secondary)]"
        }`}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span
        className={`text-[15px] font-medium flex-1 ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      <span className="text-[var(--label-tertiary)]">
        <ChevronLeft size={14} strokeWidth={2.5} className="rotate-180" />
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
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 h-10 active:bg-[var(--fill-quaternary)]"
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          {title}
        </span>
        <span
          className={`text-[var(--label-tertiary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>
      {open && <div className="border-t border-[var(--separator)]">{children}</div>}
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
        className="w-full h-10 text-[20px] font-bold text-[var(--label)] bg-[var(--fill-tertiary)] border border-transparent rounded-lg px-2 focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
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
      className="w-full text-left text-[20px] font-bold text-[var(--label)] active:opacity-60"
    >
      {value || <span className="text-[var(--label-tertiary)]">Без имени</span>}
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
          className="flex-1 h-9 text-[14px] tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-lg px-2 focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="flex-1 text-left text-[14px] text-[var(--label-secondary)] tabular-nums active:opacity-60"
        >
          {value || <span className="text-[var(--label-tertiary)]">Без телефона</span>}
        </button>
      )}
      {digits && !editing && (
        <a
          href={`tel:${digits}`}
          aria-label="Позвонить"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] bg-[rgba(52,199,89,0.12)] active:bg-[rgba(52,199,89,0.2)]"
        >
          <PhoneIcon size={16} strokeWidth={2} />
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
        placeholder="Заметки о клиенте…"
        className="w-full mt-2 p-2 text-[12px] text-[var(--label)] bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.25)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[rgba(255,149,0,0.35)]"
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
      className="mt-2 w-full text-left text-[13px] text-[var(--label-secondary)] active:opacity-60"
    >
      {value ? (
        <div className="p-2 rounded-lg bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.25)] text-[var(--system-orange)] whitespace-pre-wrap flex items-start gap-2">
          <MessageSquare size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--system-orange)]" />
          <span>{value}</span>
        </div>
      ) : (
        <span className="text-[var(--label-tertiary)]">+ Заметки о клиенте</span>
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
        className="w-16 h-8 text-[13px] text-right tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-lg px-2 focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
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
      className="text-[13px] font-semibold text-[var(--label)] tabular-nums active:opacity-60"
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
        className="flex-1 h-8 px-2 text-[13px] text-right bg-[var(--fill-tertiary)] border border-transparent rounded-lg focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
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
      className="flex-1 h-8 text-right text-[13px] active:opacity-60 text-[var(--label-secondary)] truncate"
    >
      {value || <span className="text-[var(--label-tertiary)]">{placeholder || "—"}</span>}
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
      <span className="text-[13px] text-[var(--label-secondary)] flex-shrink-0">{label}</span>
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
      <span className="flex-shrink-0 text-[var(--system-red)]">
        <MapPin size={14} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {location.label || "Объект"}
          {location.isPrimary && (
            <span className="text-[12px] text-[var(--accent)] ml-1 font-normal">· основной</span>
          )}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate">
          {location.address || "Google Maps ссылка"}
        </div>
      </div>
      <button
        type="button"
        onClick={openMaps}
        aria-label="Навигация"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-blue)] bg-[rgba(0,122,255,0.12)] active:bg-[rgba(0,122,255,0.2)]"
      >
        <ArrowUpRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function AppointmentRow({ apt }: { apt: Appointment }) {
  const statusBadge = (() => {
    if (apt.status === "completed")
      return { text: "Выполнено", color: "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]" };
    if (apt.status === "cancelled")
      return { text: "Отменено", color: "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]" };
    if (apt.status === "in_progress")
      return { text: "В работе", color: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" };
    return { text: "Запланировано", color: "bg-[rgba(0,122,255,0.12)] text-[var(--system-blue)]" };
  })();

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--label)] truncate">
          {apt.comment || "—"}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
          {formatAptDate(apt.date)} · {apt.time_start}
        </div>
      </div>
      <span
        className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.color}`}
      >
        {statusBadge.text}
      </span>
      <span className="flex-shrink-0 text-[13px] font-bold text-[var(--system-green)] tabular-nums w-14 text-right">
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
