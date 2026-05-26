"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client } from "@babun/shared/local/clients";
import { createBlankClient } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import DialogModal from "./DialogModal";
import { matchesClient, findDuplicateCandidates } from "@babun/shared/local/selectors/client-search";
// v514 P0 #2.2 — route inline-create through the dashboard's Supabase
// client mutator (clientsCached → IDB optimistic + Supabase write +
// offline queue) instead of the localStorage-only `upsertClient` we
// previously imported from @babun/shared/local/clients. Without this,
// a client created via the «+ Новый клиент» button never reached the
// server and disappeared from /dashboard/clients on reload.
import { useClients } from "@/components/layout/DashboardClientLayout";
import { reportSyncError } from "@/lib/sync/sync-error-bus";

interface ClientPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
  clients: Client[];
  // Used to sort: id of clients that appear in recent appointments
  recentClientIds?: string[];
  /** v722 — open straight into the «new client» form (quick «+ Новый»
   *  on the form, bypassing search). */
  startInCreate?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}


export default function ClientPickerSheet({
  open,
  onClose,
  onSelect,
  clients,
  recentClientIds = [],
  startInCreate = false,
}: ClientPickerSheetProps) {
  const { upsertClient } = useClients();
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  // v722 — when opened via the form's quick «+ Новый», jump straight
  // into the create form. Reset both on close so the next open of the
  // plain «Выбрать клиента» path lands on search.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNewForm(startInCreate);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNewForm(false);
    }
  }, [open, startInCreate]);
  // v514 P0 #2.2 — surface the in-flight Supabase write and any
  // failure inline. Without this the dispatcher tapped «Добавить»,
  // the form vanished, and (when the server rejected) the new
  // client was silently gone.
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // STORY-011: comment is now always visible alongside name and
  // phone. Only Telegram / Instagram / extra phones stay behind "+ …"
  // chips with removable ✕.
  const [newName, setNewName] = useState("");
  const [newPhones, setNewPhones] = useState<string[]>([""]);
  const [newComment, setNewComment] = useState("");
  // v725 — comment is opt-in via «+ Заметка» chip (fewer fields up front).
  const [showComment, setShowComment] = useState(false);
  const [newTelegram, setNewTelegram] = useState<string | null>(null);
  const [newInstagram, setNewInstagram] = useState<string | null>(null);

  // v730 — REMOVED the auto clipboard-peek that ran on form-open.
  // `navigator.clipboard.readText()` triggers iOS Safari's native
  // «Вставить» (Paste) authorization callout the moment the «Новый
  // клиент» form opens — unprompted. Worse, that callout steals focus
  // from the autoFocus name input, so the dispatcher couldn't type the
  // name, it stayed empty, and «Добавить» (which needs name + phone)
  // stayed disabled. The operator reads this as «кнопка не нажимается и
  // пишет вставить». The convenience never justified the cost: iOS
  // already offers a native long-press → Paste on the phone field.

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    return clients.filter((c) => matchesClient(c, query));
  }, [clients, query]);

  // Duplicate candidates — recomputed every keystroke in the new-client
  // form. Only shown when the draft has enough signal (>=3 letters in
  // the name OR >=5 digits in the first phone), otherwise too noisy.
  const duplicates = useMemo(() => {
    if (!showNewForm) return [] as Client[];
    const draftName = newName.trim();
    const draftPhone = newPhones[0] ?? "";
    const digits = draftPhone.replace(/\D/g, "");
    if (draftName.length < 3 && digits.length < 5) return [] as Client[];
    return findDuplicateCandidates(clients, { full_name: draftName, phone: draftPhone });
  }, [clients, showNewForm, newName, newPhones]);

  const sorted = useMemo(() => {
    const recentSet = new Set(recentClientIds);
    const withRank = filtered.map((c) => ({
      c,
      recentIdx: recentClientIds.indexOf(c.id),
    }));
    return withRank.sort((a, b) => {
      const aRecent = recentSet.has(a.c.id);
      const bRecent = recentSet.has(b.c.id);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      if (aRecent && bRecent) return a.recentIdx - b.recentIdx;
      return a.c.full_name.localeCompare(b.c.full_name, "ru");
    });
  }, [filtered, recentClientIds]);

  const handleSelect = (c: Client) => {
    onSelect(c);
    onClose();
  };

  // Phone validation: at least 7 digits (covers +357 99 XXX XXX as well
  // as legacy 8-digit local numbers). Sprint 024 STORY-007 / C3 — the
  // settings flag "Телефон обязателен" was decorative, the form would
  // happily save a phone-less client and then disable the call button.
  const phoneDigitsCount = newPhones[0]?.replace(/\D/g, "").length ?? 0;
  const phoneMissing = phoneDigitsCount < 7;
  const canCreateClient = newName.trim().length > 0 && !phoneMissing;

  const handleCreateNew = async () => {
    if (creating) return; // double-tap guard
    const name = newName.trim();
    if (!name) return;
    if (phoneMissing) return; // double-guard
    const phones = newPhones.map((p) => p.trim()).filter(Boolean);
    const client = createBlankClient({
      full_name: name,
      phone: phones[0] ?? "",
      phones: phones.slice(1).map((number) => ({
        id: generateId("ph"),
        number,
        label: "Доп.",
      })),
      telegram_username: (newTelegram ?? "").trim().replace(/^@+/, ""),
      instagram_username: (newInstagram ?? "").trim().replace(/^@+/, ""),
      comment: newComment.trim(),
    });
    setCreating(true);
    setCreateError(null);
    try {
      // v514 P0 #2.2 — await the Supabase round-trip BEFORE closing
      // the sheet. The cached wrapper inside DashboardClientLayout
      // does an optimistic IDB write + state update first, so the
      // user-visible select-and-close is still fast; if Supabase
      // rejects (RLS / validation / quota) we surface that here
      // instead of silently dropping the row.
      await upsertClient(client);
      onSelect(client);
      resetForm();
      setShowNewForm(false);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить клиента";
      setCreateError(message);
      reportSyncError(err);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewPhones([""]);
    setNewComment("");
    setShowComment(false);
    setNewTelegram(null);
    setNewInstagram(null);
  };

  const resetAndClose = () => {
    setShowNewForm(false);
    resetForm();
    setQuery("");
    onClose();
  };

  const updatePhone = (idx: number, value: string) => {
    setNewPhones((prev) => prev.map((p, i) => (i === idx ? value : p)));
  };
  const removePhone = (idx: number) => {
    setNewPhones((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  };

  // Recent chip strip — up to 5 tap targets above the list. Keeps
  // the dispatcher one tap away from last week's usual suspects, which
  // is ~80 % of the bookings. Only shown when not searching.
  const recentChipClients = useMemo(() => {
    if (query.trim()) return [];
    const byId = new Map(clients.map((c) => [c.id, c]));
    return recentClientIds
      .map((id) => byId.get(id))
      .filter((c): c is Client => Boolean(c))
      .slice(0, 5);
  }, [clients, recentClientIds, query]);

  // Back from the «new client» step to the list (header arrow + «Отмена»).
  const backToList = () => {
    setShowNewForm(false);
    setCreateError(null);
    resetForm();
  };

  return (
    <DialogModal
      open={open}
      onClose={resetAndClose}
      title={showNewForm ? "Новый клиент" : "Выбрать клиента"}
      onBack={showNewForm ? backToList : undefined}
    >
      <div className="p-3 space-y-2">
        {/* Search — hidden while creating a client (clean focused step) */}
        {!showNewForm && (
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или телефону"
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
          </div>
        )}

        {recentChipClients.length > 0 && !showNewForm && (
          <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1">
            {recentChipClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[var(--accent-tint)] border border-[var(--accent)] active:scale-[0.97]"
              >
                <span className="w-7 h-7 rounded-full bg-[var(--surface-card)] text-[var(--accent)] flex items-center justify-center text-[12px] font-semibold shrink-0">
                  {initials(c.full_name)}
                </span>
                <span className="text-[12px] font-semibold text-[var(--accent)] truncate max-w-[120px]">
                  {c.full_name}
                </span>
              </button>
            ))}
          </div>
        )}

        {!showNewForm ? (
          <button
            type="button"
            onClick={() => {
              const q = query.trim();
              if (/^[+\d\s()-]+$/.test(q) && q.replace(/\D/g, "").length >= 5) {
                setNewPhones([q]);
              } else if (q) {
                setNewName(q);
              }
              setShowNewForm(true);
            }}
            className="w-full h-11 flex items-center justify-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] rounded-[10px] text-[15px] font-semibold active:scale-[0.98] transition"
          >
            <span className="text-[15px] leading-none">+</span>
            <span>Новый клиент{query.trim() ? ` «${query.trim()}»` : ""}</span>
          </button>
        ) : (
          <div className="space-y-2.5">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя клиента *"
              className="w-full h-11 px-3.5 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />

            {duplicates.length > 0 && (
              <div className="rounded-[10px] bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.2)] px-3 py-2 text-[12px] text-[var(--label)]">
                <div className="font-semibold">Уже есть похожие</div>
                {duplicates.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      handleSelect(c);
                      setShowNewForm(false);
                      resetForm();
                    }}
                    className="w-full flex items-center justify-between gap-2 mt-1 py-1 text-[var(--label)] active:opacity-70"
                  >
                    <span className="truncate">
                      {c.full_name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--system-orange)] shrink-0">
                      Выбрать →
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* First phone — always visible, no remove. */}
            <div className="flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] px-3 h-11">
              <span className="text-[var(--system-green)] flex-shrink-0" aria-hidden>
                <PhoneIcon />
              </span>
              <input
                type="tel"
                value={newPhones[0] ?? ""}
                onChange={(e) => updatePhone(0, e.target.value)}
                placeholder="+357 99 …"
                className="flex-1 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent focus:outline-none"
              />
            </div>
            {phoneMissing && newName.trim().length > 0 && (
              <div className="text-[12px] text-[var(--system-red)] -mt-1 px-1">
                Введите телефон, иначе кнопка «Позвонить» не сработает
              </div>
            )}

            {/* v725 — comment moved behind a «+ Заметка» chip to keep the
                create step to just Name + Phone by default. */}
            {showComment && (
              <div className="flex items-start gap-2 bg-[var(--surface-card)] rounded-[10px] px-3 py-2 border border-[var(--separator)]">
                <span className="text-[var(--label-tertiary)] flex-shrink-0 mt-2" aria-hidden>
                  <CommentIcon />
                </span>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Заметки (язык, особенности, аллергии)"
                  rows={2}
                  autoFocus
                  className="flex-1 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent focus:outline-none resize-none leading-[1.35]"
                />
              </div>
            )}

            {/* Extra phones — with ✕ to remove. */}
            {newPhones.slice(1).map((phone, sliceIdx) => {
              const idx = sliceIdx + 1;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] px-3 h-11"
                >
                  <span className="text-[var(--system-green)] flex-shrink-0" aria-hidden>
                    <PhoneIcon />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    placeholder="Доп. номер"
                    className="flex-1 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePhone(idx)}
                    className="w-7 h-7 flex items-center justify-center text-[var(--label-tertiary)] active:text-[var(--label)]"
                    aria-label="Убрать номер"
                  >
                    <CloseIcon />
                  </button>
                </div>
              );
            })}

            {newTelegram !== null && (
              <FieldRow
                icon={<TelegramIcon />}
                value={newTelegram}
                onChange={setNewTelegram}
                onRemove={() => setNewTelegram(null)}
                placeholder="Telegram @username"
              />
            )}
            {newInstagram !== null && (
              <FieldRow
                icon={<InstagramIcon />}
                value={newInstagram}
                onChange={setNewInstagram}
                onRemove={() => setNewInstagram(null)}
                placeholder="Instagram @username"
              />
            )}

            {/* Add-chips — keep the create step to Name + Phone; comment
                and socials are opt-in. */}
            <div className="pt-1">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Добавить (необязательно)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!showComment && (
                  <AddChip label="+ Заметка" onClick={() => setShowComment(true)} />
                )}
                <AddChip
                  label="+ Ещё номер"
                  onClick={() => setNewPhones((prev) => [...prev, ""])}
                />
                {newTelegram === null && (
                  <AddChip label="+ Telegram" onClick={() => setNewTelegram("")} />
                )}
                {newInstagram === null && (
                  <AddChip label="+ Instagram" onClick={() => setNewInstagram("")} />
                )}
              </div>
            </div>

            {createError && (
              <div
                role="alert"
                className="rounded-[10px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.25)] px-3 py-2 text-[12px] text-[var(--system-red)]"
              >
                {createError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setCreateError(null);
                  resetForm();
                }}
                disabled={creating}
                className="flex-1 h-11 text-[var(--accent)] font-medium disabled:text-[var(--label-tertiary)]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={!canCreateClient || creating}
                className="flex-1 h-11 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-[10px] font-semibold text-[15px] active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
                title={
                  !newName.trim()
                    ? "Введите имя"
                    : phoneMissing
                      ? "Введите телефон (минимум 7 цифр)"
                      : ""
                }
              >
                {creating ? "Сохраняем…" : "Добавить"}
              </button>
            </div>
          </div>
        )}

        {/* Client list — hidden during the «new client» step. */}
        {!showNewForm && (
        <div>
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--label-tertiary)]">
              {query ? "Никого не нашли" : "Клиентов пока нет"}
            </div>
          ) : (
            <div className="divide-y divide-[var(--separator)]">
              {sorted.map(({ c }) => {
                const isRecent = recentClientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full flex items-center gap-2.5 py-2 min-h-[48px] active:bg-[var(--fill-quaternary)]"
                  >
                    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center font-semibold text-[13px]">
                      {initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[15px] font-semibold text-[var(--label)] truncate">
                        {c.full_name}
                      </div>
                      {c.phone && (
                        <div className="text-[12px] text-[var(--label-secondary)] truncate">{c.phone}</div>
                      )}
                    </div>
                    {isRecent && (
                      <div className="text-[12px] font-semibold text-[var(--accent)] bg-[var(--accent-tint)] px-1.5 py-0.5 rounded-full">
                        недавний
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </DialogModal>
  );
}

function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 rounded-full bg-[var(--surface-card)] border border-[var(--separator)] text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
    >
      {label}
    </button>
  );
}

function FieldRow({
  icon,
  value,
  onChange,
  onRemove,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] px-3 h-11">
      <span className="flex-shrink-0" aria-hidden>
        {icon}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent focus:outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center text-[var(--label-tertiary)] active:text-[var(--label)]"
        aria-label="Убрать поле"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <span className="text-[#229ED9]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821l.001-.001c.321-1.496-.541-2.081-1.527-1.714L1.114 10.247c-1.462.568-1.44 1.384-.249 1.752l5.535 1.723 12.856-8.09c.605-.402 1.155-.179.703.223z" />
      </svg>
    </span>
  );
}

function InstagramIcon() {
  return (
    <span
      className="text-[var(--label-on-accent)] w-5 h-5 rounded flex items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 30% 110%, #ffd86b 0%, #fa8a3c 25%, #e6313b 50%, #c13584 75%, #833ab4 100%)",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    </span>
  );
}

function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
