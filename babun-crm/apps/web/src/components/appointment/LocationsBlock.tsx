"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@babun/shared/local/clients";
import { upsertClient } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { extractAddressFromMapUrl, isLikelyUrl } from "@babun/shared/common/utils/map-links";
import { useLocationLabels } from "@/app/dashboard/layout";
import { Navigation } from "@babun/shared/icons";
import MapNavPopup from "./MapNavPopup";

interface LocationsBlockProps {
  client: Client | null;
  selectedLocationId: string | null;
  readOnly?: boolean;
  addressNote: string;
  onSelectLocation: (id: string) => void;
  onAddressNoteChange: (note: string) => void;
}

type Mode = "idle" | "form";

// Inline address block — no popup. Three states:
//   no client  → greyed row "Сначала выберите клиента"
//   empty      → "+ Добавить адрес" row; tapping reveals inline form
//   filled     → address row + Nav + note; "+ Добавить ещё адрес" link;
//                tap on the row enters edit mode (same inline form,
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
  onAddressNoteChange,
}: LocationsBlockProps) {
  const { locationLabels } = useLocationLabels();
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [input, setInput] = useState("");
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
  const clientLocked = !client;
  const presets = locationLabels.map((l) => l.name);

  // Close form if the user picks a different location externally.
  useEffect(() => {
    if (!hasAddress && mode === "idle") return;
    // no-op — form doesn't need to auto-close in idle mode
  }, [hasAddress, mode]);

  const openNew = () => {
    setEditingId(null);
    setLabel("");
    setCustomMode(false);
    setInput("");
    setMode("form");
  };

  const openEdit = (loc: Location) => {
    setEditingId(loc.id);
    const isPreset = presets.includes(loc.label);
    const legacySeed = loc.label === "Основной";
    setLabel(legacySeed ? "" : loc.label ?? "");
    setCustomMode(!legacySeed && loc.label !== "" && !isPreset);
    setInput(loc.address || loc.mapUrl || "");
    setMode("form");
  };

  const cancelForm = () => {
    setMode("idle");
    setEditingId(null);
    setLabel("");
    setCustomMode(false);
    setInput("");
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

    if (editingId) {
      // Edit existing location — whether it was a legacy "Основной"
      // seed or a real one, we rewrite in place and mark as primary
      // if nothing else was primary yet.
      const existing = rawLocations.find((l) => l.id === editingId);
      if (!existing) return;
      const updated: Location = {
        ...existing,
        label: lbl || existing.label || "Объект",
        address,
        mapUrl,
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

  const navInput = selected?.mapUrl || selected?.address || "";

  return (
    <div className="px-4 pt-2">
      <div
        className={`rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] overflow-hidden ${
          clientLocked ? "opacity-60" : ""
        }`}
      >
        {/* Multi-address chip switcher + [+] at the right edge */}
        {!clientLocked && realLocations.length >= 1 && mode !== "form" && (
          <div
            className="px-2 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {realLocations.map((loc) => {
              const active = loc.id === selected?.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    onSelectLocation(loc.id);
                  }}
                  className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-semibold border ${
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
                className="flex-shrink-0 ml-auto w-7 h-7 rounded-full border border-dashed border-[var(--accent)] text-[var(--accent)] text-[14px] font-bold flex items-center justify-center active:bg-[var(--accent-tint)]"
              >
                +
              </button>
            )}
          </div>
        )}

        {/* Row 1: address or empty CTA */}
        {clientLocked ? (
          <div className="h-12 flex items-center gap-2 px-3">
            <span className="flex-shrink-0 text-[var(--label-tertiary)]">
              <PinIcon />
            </span>
            <span className="flex-1 text-[13px] font-medium text-[var(--label-tertiary)] truncate">
              Сначала выберите клиента
            </span>
          </div>
        ) : hasAddress ? (
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
        {mode === "form" && !readOnly && !clientLocked && (
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
                placeholder="Адрес или Google Maps ссылка"
                autoFocus={!customMode}
                className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
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
                  className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-[var(--separator)]" />

        {/* Row 2: Navigation (full width) */}
        <div className="p-2">
          <button
            type="button"
            disabled={!hasAddress}
            onClick={() => setNavOpen(true)}
            className={`w-full h-10 rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 ${
              hasAddress
                ? "bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--accent-tint)]/70"
                : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)]"
            }`}
          >
            <Navigation size={14} strokeWidth={2} />
            Навигация
          </button>
        </div>

        <div className="h-px bg-[var(--separator)]" />

        {/* Row 3: inline small note */}
        <div className="px-3 py-2">
          {readOnly ? (
            <div className="text-[12px] text-[var(--label-secondary)]">
              <span className="text-[var(--label-tertiary)]">Примечание: </span>
              {addressNote.trim() || <span className="text-[var(--label-quaternary)]">—</span>}
            </div>
          ) : (
            <input
              type="text"
              value={addressNote}
              onChange={(e) => onAddressNoteChange(e.target.value)}
              disabled={clientLocked}
              placeholder="Примечание: дом, этаж, квартира…"
              className="w-full h-7 text-[12px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent border-0 focus:outline-none disabled:opacity-50"
            />
          )}
        </div>

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
