"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@babun/shared/local/clients";
import { upsertClient } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { extractAddressFromMapUrl, isLikelyUrl } from "@babun/shared/common/utils/map-links";
import { useLocationLabels } from "@/components/layout/DashboardClientLayout";
import { Navigation } from "@babun/shared/icons";
import MapNavPopup from "./MapNavPopup";
import AddressEditorPopup from "./AddressEditorPopup";

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
   *  of opening the form. */
  onRequireClient?: () => void;
  /** When true (headless mount from ObjectCard) the editor opens
   *  immediately on mount — editing the selected/primary object, or a
   *  new one if the client has none. Without this the hidden h-0 host
   *  swallows the tap and nothing happens. */
  autoOpen?: boolean;
  /** Called after the editor closes or saves so the parent can reset
   *  its trigger and unmount the headless instance. */
  onClose?: () => void;
}

// Note max length — matches Location.note constraint (140 chars).
const NOTE_MAX = 140;

interface EditorState {
  editingId: string | null;
  label: string;
  custom: boolean;
  input: string;
  note: string;
}

// Address block — popup-based editing (v753).
// Three visual states:
//   no client  → greyed row "Сначала выберите клиента"
//   empty      → "+ Добавить адрес" row; tapping opens centered popup
//   filled     → address row + Nav + object note; "+ Добавить ещё адрес"
//                chip at right; tap on the row opens edit popup (prefilled).
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
  autoOpen,
  onClose,
}: LocationsBlockProps) {
  const { locationLabels } = useLocationLabels();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [navOpen, setNavOpen] = useState(false);

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

  // Close editor popup if the client changes while it is open.
  useEffect(() => {
    setEditor(null);
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    if (!client) {
      onRequireClient?.();
      return;
    }
    setEditor({
      editingId: null,
      label: "",
      custom: false,
      input: "",
      note: "",
    });
  };

  const openEdit = (loc: Location) => {
    const isPreset = presets.includes(loc.label);
    const legacySeed = loc.label === "Основной";
    setEditor({
      editingId: loc.id,
      label: legacySeed ? "" : loc.label ?? "",
      custom: !legacySeed && loc.label !== "" && !isPreset,
      input: loc.address || loc.mapUrl || "",
      note: loc.note ?? "",
    });
  };

  // Headless mount via ObjectCard tap — open the editor immediately so
  // the hidden h-0 host doesn't swallow the interaction. Edit the
  // selected/primary object, or start a new one if the client has none.
  useEffect(() => {
    if (!autoOpen || !client) return;
    if (selected) openEdit(selected);
    else openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditorSave = (data: {
    label: string;
    input: string;
    note: string;
  }) => {
    if (!client) return;
    const rawInput = data.input.trim();
    const lbl = data.label.trim();
    if (!rawInput && !lbl) return;

    const isUrl = isLikelyUrl(rawInput);
    const mapUrl = isUrl ? rawInput : undefined;
    const address = isUrl
      ? (extractAddressFromMapUrl(rawInput) ?? "")
      : rawInput;
    const note = data.note.trim().slice(0, NOTE_MAX) || undefined;

    const editingId = editor?.editingId ?? null;

    if (editingId) {
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

    setEditor(null);
    onClose?.();
  };

  const handleEditorClose = () => {
    setEditor(null);
    onClose?.();
  };

  const navInput = selected?.mapUrl || selected?.address || "";

  const editorTitle = editor?.editingId ? "Объект" : "Новый объект";

  return (
    <div className="px-4 pt-3">
      <div className="rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden">
        {/* v616 §6 — multi-address chip switcher + [+] at the right
            edge. Chips themselves only render for 2+ locations; with
            a single one the row collapses to just the [+] add button
            so the operator can still add a sibling location. */}
        {realLocations.length >= 1 && (
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

        {/* Row 3: per-object note — read-only display. Tapping opens the
            edit popup seeded with the selected location's current note. */}
        {hasAddress && !readOnly && (
          <>
            <div className="h-px bg-[var(--separator)]" />
            <button
              type="button"
              onClick={() => selected && openEdit(selected)}
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

      {/* Address editor popup — centered, keyboard-safe (v753). */}
      {editor !== null && (
        <AddressEditorPopup
          open={editor !== null}
          title={editorTitle}
          presets={presets}
          initialLabel={editor.label}
          initialCustom={editor.custom}
          initialInput={editor.input}
          initialNote={editor.note}
          addrPlaceholder={addrPlaceholder}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}
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
