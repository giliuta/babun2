"use client";

import { useState } from "react";
import type { Client, Location } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";

interface LocationsBlockProps {
  client: Client;
  selectedLocationId: string | null;
  readOnly?: boolean;
  onSelectLocation: (id: string) => void;
  /** Parent persists the new location on the Client and re-selects it
   *  atomically (upsertClient + setLocationId in one tick). */
  onAddLocation: (loc: Location) => void;
}

const LABEL_PRESETS = ["Дом", "Офис", "Квартира", "Вилла"];

// STORY-011 unified locations + address card. Shown right below the
// client header. Three states:
//   • no locations yet → inline "add first object" form
//   • locations present, picker idle → chip row + selected address +
//     Maps / Copy actions
//   • locations present, "+ Объект" tapped → chip row stays, address
//     panel replaced by the add form
export default function LocationsBlock({
  client,
  selectedLocationId,
  readOnly,
  onSelectLocation,
  onAddLocation,
}: LocationsBlockProps) {
  const locations = client.locations;
  const hasLocations = locations.length > 0;

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMapUrl, setNewMapUrl] = useState("");
  const [newAcUnits, setNewAcUnits] = useState("");
  const [copied, setCopied] = useState(false);

  // Empty state auto-shows the form; user-triggered add also shows it.
  const formVisible = !hasLocations || showAdd;

  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isPrimary) ??
    locations[0] ??
    null;

  const resetForm = () => {
    setNewLabel("");
    setNewAddress("");
    setNewMapUrl("");
    setNewAcUnits("");
  };

  const saveNew = () => {
    const addr = newAddress.trim();
    const lbl = newLabel.trim();
    if (!addr && !lbl) return;
    const acUnits = Number.parseInt(newAcUnits.trim(), 10);
    const loc: Location = {
      id: generateId("loc"),
      label: lbl || "Объект",
      address: addr,
      mapUrl: newMapUrl.trim() || undefined,
      acUnits: Number.isFinite(acUnits) && acUnits > 0 ? acUnits : 0,
      // First object becomes primary; later ones don't steal that flag.
      isPrimary: !hasLocations,
    };
    onAddLocation(loc);
    resetForm();
    setShowAdd(false);
  };

  const openMaps = () => {
    if (!selectedLocation) return;
    const url =
      selectedLocation.mapUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        selectedLocation.address
      )}`;
    window.open(url, "_blank", "noopener");
  };

  const copyAddress = async () => {
    if (!selectedLocation?.address) return;
    try {
      await navigator.clipboard.writeText(selectedLocation.address);
      haptic("success");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (http, denied) — swallow silently
    }
  };

  return (
    <div className="px-4 pt-3">
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {hasLocations && (
          <>
            <div className="px-3 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Объекты ({locations.length})
              </div>
            </div>
            <div
              className="px-2 pb-3 flex items-stretch gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {locations.map((loc) => {
                const active = loc.id === selectedLocation?.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onSelectLocation(loc.id)}
                    className={`flex-shrink-0 min-w-[74px] px-3 py-2 rounded-xl text-left transition ${
                      active
                        ? "bg-violet-50 border-[1.5px] border-violet-600"
                        : "bg-white border-[1.5px] border-slate-200"
                    } ${readOnly ? "" : "active:scale-[0.98]"}`}
                  >
                    <div
                      className={`text-[14px] font-bold truncate ${
                        active ? "text-violet-700" : "text-slate-900"
                      }`}
                    >
                      {loc.label || "Объект"}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5 tabular-nums">
                      {loc.acUnits > 0 ? `${loc.acUnits} бл.` : "—"}
                    </div>
                  </button>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="flex-shrink-0 min-w-[88px] px-3 py-2 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50"
                >
                  + Объект
                </button>
              )}
            </div>
          </>
        )}

        {/* Selected-address panel — hidden while the add form is up. */}
        {hasLocations && !formVisible && selectedLocation && (
          <>
            <div className="h-px bg-slate-100 mx-3" />
            <div className="px-3 py-3">
              <div className="flex items-start gap-2 text-[14px] text-slate-900">
                <span className="flex-shrink-0 mt-0.5 text-rose-500">
                  <PinIcon />
                </span>
                <span className="flex-1 leading-snug">
                  {selectedLocation.address ? (
                    selectedLocation.address
                  ) : (
                    <span className="text-slate-400 italic">адрес не указан</span>
                  )}
                </span>
              </div>
              {selectedLocation.address && (
                <div className="mt-2 ml-6 flex items-center gap-4 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={openMaps}
                    className="inline-flex items-center gap-1 text-sky-700 active:opacity-60"
                  >
                    <MapIcon /> Карты
                  </button>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="inline-flex items-center gap-1 text-slate-600 active:opacity-60"
                  >
                    <CopyIcon /> {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Inline add form. */}
        {formVisible && !readOnly && (
          <>
            {hasLocations && <div className="h-px bg-slate-100 mx-3" />}
            <div className="px-3 py-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {hasLocations ? "Новый объект" : "Адрес объекта"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LABEL_PRESETS.map((lbl) => {
                  const active = newLabel === lbl;
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setNewLabel(lbl)}
                      className={`h-8 px-3 rounded-full text-[12px] font-semibold transition ${
                        active
                          ? "bg-violet-100 text-violet-700 border border-violet-300"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Название (или своё)"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <textarea
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Адрес (улица, дом, кв.)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <input
                type="url"
                value={newMapUrl}
                onChange={(e) => setNewMapUrl(e.target.value)}
                placeholder="Google Maps URL (необязательно)"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={newAcUnits}
                onChange={(e) => setNewAcUnits(e.target.value)}
                placeholder="Блоков A/C (необязательно)"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 tabular-nums"
              />
              <div className="flex gap-2 pt-1">
                {hasLocations && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowAdd(false);
                    }}
                    className="flex-1 h-10 rounded-lg text-slate-600 font-medium"
                  >
                    Отмена
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={!newAddress.trim() && !newLabel.trim()}
                  className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.98] disabled:opacity-40"
                >
                  {hasLocations ? "Сохранить" : "Сохранить адрес"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
