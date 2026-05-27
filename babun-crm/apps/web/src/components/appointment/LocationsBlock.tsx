"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@babun/shared/local/clients";
import { upsertClient } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { extractAddressFromMapUrl, isLikelyUrl } from "@babun/shared/common/utils/map-links";
import { useLocationLabels } from "@/components/layout/DashboardClientLayout";
import { Navigation } from "@babun/shared/icons";
import MapNavPopup from "./MapNavPopup";

interface LocationsBlockProps {
  client: Client | null;
  selectedLocationId: string | null;
  readOnly?: boolean;
  addressNote: string;
  onSelectLocation: (id: string) => void;
  /** v660 — kept on the prop type so existing callers still typecheck.
   *  The inline note input was removed; CommentBlock handles brigade
   *  notes now. View-mode still renders historic address_note text. */
  onAddressNoteChange?: (note: string) => void;
  /** Placeholder hint driven by the day's city-tag, e.g.
   *  "Лимассол, ул. ..." or fallback "Адрес или Google Maps ссылка". */
  placeholder?: string;
  /** Called when the user taps «+ Добавить адрес» but no client is
   *  selected yet. Parent shows the "выберите клиента" prompt instead
   *  of opening the inline form. */
  onRequireClient?: () => void;
}

type Mode = "idle" | "form";

// Note max length — matches Location.note constraint (140 chars).
const NOTE_MAX = 140;

// Inline address block — no popup. Three states:
//   no client  → greyed row "Сначала выберите клиента"
//   empty      → "+ Добавить адрес" row; tapping reveals inline form
//   filled     → address row + Nav + object note; "+ Добавить ещё адрес"
//                link; tap on the row enters edit mode (same inline form,
//                prefilled). If client has multiple non-empty locations,
//                chips above the row let you switch.
//
// Legacy empty seed locations (label "Основной", no address, no mapUrl)
// are filtered out of display — Dima asked them not to show.
export default function LocationsBlock({
  client,
  selectedLocationId,
  readOnly,
  addressNote,
  onSelectLocation,
  placeholder,
  onRequireClient,
}: LocationsBlockProps) {
  const { locationLabels } = useLocationLabels();
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [input, setInput] = useState("");
  // Per-object note in the add/edit form.
  const [noteInput, setNoteInput] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  // Inline note edit for the selected (non-form) address.
  const [editingNote, setEditingNote] = useState(false);
  const [inlineNote, setInlineNote] = useState("");

  const rawLocations: Location[] = client?.locations ?? [];
  const realLocations = rawLocations.filter(
    (l) => l.address || l.mapUrl
  );

  const selected =
    realLocations.find((l) => l.id === selectedLocationId) ??
    realLocations.find((l) => l.isPrimary) ??
    realLocations[0] ??
    null;

  const hasAddress = Boolean(selected);
  const presets = locationLabels.map((l) => l.name);
  const addrPlaceholder = placeholder ?? "Адрес или Google Maps ссылка";

  // Sync inline note field when the selected location changes.
  useEffect(() => {
    setInlineNote(selected?.note ?? "");
    setEditingNote(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close form if the user picks a different location externally.
  useEffect(() => {
    if (!hasAddress && mode === "idle") return;
    // no-op — form doesn't need to auto-close in idle mode
  }, [hasAddress, mode]);

  const openNew = () => {
    // When no client is selected, intercept the tap and ask the
    // dispatcher to pick a client first instead of opening the form.
    if (!client) {
      onRequireClient?.();
      return;
    }
    setEditingId(null);
    setLabel("");
    setCustomMode(false);
    setInput("");
    setNoteInput("");
    setMode("form");
  };

  const openEdit = (loc: Location) => {
    setEditingId(loc.id);
    const isPreset = presets.includes(loc.label);
    const legacySeed = loc.label === "Основной";
    setLabel(legacySeed ? "" : loc.label ?? "");
    setCustomMode(!legacySeed && loc.label !== "" && !isPreset);
    setInput(loc.address || loc.mapUrl || "");
    setNoteInput(loc.note ?? "");
    setMode("form");
  };

  const cancelForm = () => {
    setMode("idle");
    setEditingId(null);
    setLabel("");
    setCustomMode(false);
    setInput("");
    setNoteInput("");
  };

  const saveForm = () => {
    if (!client) return;
    const rawInput = input.trim();
    const lbl = label.trim();
    if (!rawInput && !lbl) return;

    const isUrl = isLikelyUrl(rawInput);
    const mapUrl = isUrl ? rawInput : undefined;
    const address = isUrl
      ? (extractAddressFromMapUrl(rawInput) ?? "")
      : rawInput;
    const note = noteInput.trim().slice(0, NOTE_MAX) || undefined;

    if (editingId) {
      // Edit existing location.
      const existing = rawLocations.find((l) => l.id === editingId);
      if (!existing) return;
      const updated: Location = {
        ...existing,
        label: lbl || existing.label || "Объект",
        address,
        mapUrl,
        note,
      };
      const nextLocations = rawLocations.map((l) =>
        l.id === editingId ? updated : l
      );
      upsertClient({ ...client, locations: nextLocations });
      onSelectLocation(updated.id);
    } else {
      // Reuse legacy empty seed if present — otherwise append new.
      const emptySeedIdx = rawLocations.findIndex(
        (l) => !l.address && !l.mapUrl
      );
      const nextId =
        emptySeedIdx >= 0 ? rawLocations[emptySeedIdx].id : generateId("loc");
      const next: Location = {
        id: nextId,
        label: lbl || "Объект",
        address,
        mapUrl,
        note,
        isPrimary: realLocations.length === 0,
      };
      const nextLocations =
        emptySeedIdx >= 0
          ? rawLocations.map((l, i) => (i === emptySeedIdx ? next : l))
          : [...rawLocations, next];
      upsertClient({ ...client, locations: nextLocations });
      onSelectLocation(nextId);
    }
    cancelForm();
  };

  /** Persist a note change on the currently selected location. */
  const saveInlineNote = () => {
    if (!client || !selected) return;
    const note = inlineNote.trim().slice(0, NOTE_MAX) || undefined;
    const updated: Location = { ...selected, note };
    const nextLocations = rawLocations.map((l) =>
      l.id === selected.id ? updated : l
    );
    upsertClient({ ...client, locations: nextLocations });
    setEditingNote(false);
  };

  const navInput = selected?.mapUrl || selected?.address || "";

  return (
    <div className="px-4 pt-3">
      <div className="rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden">
        {/* v616 §6 — multi-address chip switcher + [+] at the right
            edge. Chips themselves only render for 2+ locations; with
            a single one the row collapses to just the [+] add button
            so the operator can still add a sibling location. */}
        {realLocations.length >= 1 && mode !== "form" && (
          <div
            className="px-2 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {realLocations.length >= 2 && realLocations.map((loc) => {
              const active = loc.id === selected?.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    onSelectLocation(loc.id);
                  }}
                  className={`flex-shrink-0 px-4 h-10 rounded-full text-[13px] font-semibold border ${
                    active
                      ? "bg-[var(--accent-tint)] text-[var(--accent)] border-[var(--accent)]"
                      : "bg-[var(--surface-card)] text-[var(--label-secondary)] border-[var(--separator)]"
                  }`}
                >
                  {loc.label || "Объект"}
                </button>
              );
            })}
            {!readOnly && (
              <button
                type="button"
                onClick={openNew}
                aria-label="Добавить адрес"
                className="flex-shrink-0 ml-auto w-11 h-11 rounded-full border border-dashed border-[var(--accent)] text-[var(--accent)] text-[18px] font-bold flex items-center justify-center active:bg-[var(--accent-tint)]"
              >
                +
              </button>
            )}
          </div>
        )}

        {/* Row 1: address or empty CTA */}
        {hasAddress ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => selected && openEdit(selected)}
            className={`w-full h-12 flex items-center gap-2 px-3 ${
              !readOnly ? "active:bg-[var(--fill-quaternary)]" : ""
            }`}
          >
            <span className="flex-shrink-0 text-[var(--system-red)]">
              <PinIcon />
            </span>
            <span className="flex-1 min-w-0 text-left text-[15px] text-[var(--label)] truncate">
              {selected?.address || "Google Maps ссылка"}
              {selected?.label && (
                <span className="text-[var(--label-tertiary)] ml-1">
                  · {selected.label}
                </span>
              )}
            </span>
            {!readOnly && (
              <span className="flex-shrink-0 text-[var(--label-quaternary)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={openNew}
            className="w-full h-12 flex items-center gap-2 px-3 text-left active:bg-[var(--accent-tint)]"
          >
            <span className="flex-shrink-0 text-[var(--accent)]">
              <PinIcon />
            </span>
            <span className="flex-1 text-[15px] font-semibold text-[var(--accent)]">
              + Добавить адрес
            </span>
          </button>
        )}

        {/* Inline form (add or edit) */}
        {mode === "form" && !readOnly && (
          <>
            <div className="h-px bg-[var(--separator)]" />
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const active = !customMode && label === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setCustomMode(false);
                        setLabel(p);
                      }}
                      className={`h-8 px-3 rounded-full text-[12px] font-semibold transition ${
                        active
                          ? "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]"
                          : "bg-[var(--surface-card)] text-[var(--label-secondary)] border border-[var(--separator)]"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (customMode) {
                      setCustomMode(false);
                      if (!presets.includes(label)) setLabel("");
                    } else {
                      setCustomMode(true);
                      if (presets.includes(label)) setLabel("");
                    }
                  }}
                  className={`h-8 px-3 rounded-full text-[12px] font-semibold transition ${
                    customMode
                      ? "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]"
                      : "bg-[var(--surface-card)] text-[var(--label-secondary)] border border-dashed border-[var(--separator)]"
                  }`}
                >
                  Другое…
                </button>
              </div>

              {customMode && (
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Своё название"
                  autoFocus
                  className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
                />
              )}

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={addrPlaceholder}
                autoFocus={!customMode}
                className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />

              {/* Per-object note field — persisted on Location.note. */}
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value.slice(0, NOTE_MAX))}
                placeholder="зелёная дверь, домофон 25, что на объекте…"
                rows={2}
                maxLength={NOTE_MAX}
                className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 h-11 rounded-[10px] text-[var(--accent)] font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveForm}
                  disabled={!input.trim() && !label.trim()}
                  className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </>
        )}

        {/* Row 2: Navigation — hidden when there's no address yet. */}
        {hasAddress && (
          <>
            <div className="h-px bg-[var(--separator)]" />
            <div className="p-2">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="w-full h-10 rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--accent-tint)]/70"
              >
                <Navigation size={14} strokeWidth={2} />
                Навигация
              </button>
            </div>
          </>
        )}

        {/* Row 3: per-object note. In edit mode: editable inline;
            in read-only: show the saved note (if any). */}
        {hasAddress && !readOnly && mode !== "form" && (
          <>
            <div className="h-px bg-[var(--separator)]" />
            {editingNote ? (
              <div className="px-3 py-2 space-y-1.5">
                <textarea
                  value={inlineNote}
                  onChange={(e) => setInlineNote(e.target.value.slice(0, NOTE_MAX))}
                  placeholder="зелёная дверь, домофон 25, что на объекте…"
                  rows={2}
                  maxLength={NOTE_MAX}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[13px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInlineNote(selected?.note ?? "");
                      setEditingNote(false);
                    }}
                    className="flex-1 h-9 rounded-[8px] text-[var(--accent)] text-[13px] font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={saveInlineNote}
                    className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setInlineNote(selected?.note ?? "");
                  setEditingNote(true);
                }}
                className="w-full px-3 py-2 text-left active:bg-[var(--fill-quaternary)]"
              >
                {selected?.note ? (
                  <span className="text-[12px] text-[var(--label-secondary)]">
                    {selected.note}
                  </span>
                ) : (
                  <span className="text-[12px] text-[var(--label-tertiary)]">
                    + Заметка об объекте
                  </span>
                )}
              </button>
            )}
          </>
        )}

        {/* Read-only: show saved note and legacy address_note. */}
        {readOnly && (selected?.note || addressNote.trim()) && (
          <>
            <div className="h-px bg-[var(--separator)]" />
            <div className="px-3 py-2 text-[12px] text-[var(--label-secondary)]">
              {selected?.note && (
                <div>{selected.note}</div>
              )}
              {addressNote.trim() && (
                <div className="mt-0.5">
                  <span className="text-[var(--label-tertiary)]">Примечание: </span>
                  {addressNote}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <MapNavPopup
        open={navOpen}
        onClose={() => setNavOpen(false)}
        input={navInput}
      />
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
