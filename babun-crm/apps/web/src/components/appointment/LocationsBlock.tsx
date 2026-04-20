"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@/lib/clients";
import { upsertClient } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { extractAddressFromMapUrl, isLikelyUrl } from "@/lib/map-links";
import { useLocationLabels } from "@/app/dashboard/layout";
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
        className={`rounded-xl bg-white border border-slate-200 overflow-hidden ${
          clientLocked ? "opacity-60" : ""
        }`}
      >
        {/* Multi-address chip switcher */}
        {!clientLocked && realLocations.length > 1 && (
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
                    if (mode === "form") cancelForm();
                  }}
                  className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-semibold border ${
                    active
                      ? "bg-violet-100 text-violet-700 border-violet-300"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {loc.label || "Объект"}
                </button>
              );
            })}
          </div>
        )}

        {/* Row 1: address or empty CTA */}
        {clientLocked ? (
          <div className="h-12 flex items-center gap-2 px-3">
            <span className="flex-shrink-0 text-rose-300">
              <PinIcon />
            </span>
            <span className="flex-1 text-[13px] font-medium text-slate-400 truncate">
              Сначала выберите клиента
            </span>
          </div>
        ) : hasAddress ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => selected && openEdit(selected)}
            className={`w-full h-12 flex items-center gap-2 px-3 ${
              !readOnly ? "active:bg-slate-50" : ""
            }`}
          >
            <span className="flex-shrink-0 text-rose-500">
              <PinIcon />
            </span>
            <span className="flex-1 min-w-0 text-left text-[14px] text-slate-900 truncate">
              {selected?.address || "Google Maps ссылка"}
              {selected?.label && (
                <span className="text-slate-400 ml-1">
                  · {selected.label}
                </span>
              )}
            </span>
            {!readOnly && (
              <span className="flex-shrink-0 text-slate-300">
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
            className="w-full h-12 flex items-center gap-2 px-3 text-left active:bg-violet-50"
          >
            <span className="flex-shrink-0 text-violet-500">
              <PinIcon />
            </span>
            <span className="flex-1 text-[14px] font-semibold text-violet-600">
              + Добавить адрес
            </span>
          </button>
        )}

        {/* Inline form (add or edit) */}
        {mode === "form" && !readOnly && !clientLocked && (
          <>
            <div className="h-px bg-slate-100" />
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
                          ? "bg-violet-100 text-violet-700 border border-violet-300"
                          : "bg-white text-slate-600 border border-slate-200"
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
                      ? "bg-violet-100 text-violet-700 border border-violet-300"
                      : "bg-white text-slate-600 border border-slate-200 border-dashed"
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
                  className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              )}

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Адрес или Google Maps ссылка"
                autoFocus={!customMode}
                className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 h-10 rounded-lg text-slate-600 font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveForm}
                  disabled={!input.trim() && !label.trim()}
                  className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-slate-100" />

        {/* Row 2: Navigation (full width) */}
        <div className="p-2">
          <button
            type="button"
            disabled={!hasAddress}
            onClick={() => setNavOpen(true)}
            className={`w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 border ${
              hasAddress
                ? "bg-sky-50 border-sky-200 text-sky-800 active:bg-sky-100"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span>🧭</span> Навигация
          </button>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Row 3: inline small note */}
        <div className="px-3 py-2">
          {readOnly ? (
            <div className="text-[11px] text-slate-500">
              <span className="text-slate-400">Примечание: </span>
              {addressNote.trim() || <span className="text-slate-300">—</span>}
            </div>
          ) : (
            <input
              type="text"
              value={addressNote}
              onChange={(e) => onAddressNoteChange(e.target.value)}
              disabled={clientLocked}
              placeholder="Примечание: дом, этаж, квартира…"
              className="w-full h-7 text-[11px] text-slate-700 placeholder-slate-400 bg-transparent border-0 focus:outline-none disabled:opacity-50"
            />
          )}
        </div>

        {/* Row 4: small "+ add another address" — only when an address already exists */}
        {!clientLocked && !readOnly && hasAddress && mode !== "form" && (
          <>
            <div className="h-px bg-slate-100" />
            <button
              type="button"
              onClick={openNew}
              className="w-full h-9 flex items-center justify-center text-[12px] font-semibold text-violet-600 active:bg-violet-50"
            >
              + Добавить ещё адрес
            </button>
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
