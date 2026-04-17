"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";

interface LocationsBlockProps {
  client: Client;
  selectedLocationId: string | null;
  readOnly?: boolean;
  onSelectLocation: (id: string) => void;
  /** Parent persists the upsert on the Client and re-selects the
   *  location atomically (upsertClient + setLocationId in one tick).
   *  New locations have a fresh id; edits reuse the existing id. */
  onSaveLocation: (loc: Location) => void;
}

const LABEL_PRESETS = ["Дом", "Квартира", "Офис", "Вилла"];

type FormMode = "hidden" | "add" | "edit";

// STORY-011 revised: the locations card now treats the seeded/primary
// location as something the dispatcher can fill in directly, without
// creating a second object. Behaviours:
//   • No locations OR selected location has no address → the inline
//     form auto-opens in `edit` mode, pre-filled with whatever the
//     existing location has (label, map url, A/C count). Save rewrites
//     the SAME id so address + type land on the client's record.
//   • Filled location → address strip with Maps / Copy / ✎ Изменить.
//     Tapping ✎ drops the form open for the selected loc.
//   • + Объект → `add` mode with a blank form, save creates a new
//     Location with a fresh id.
export default function LocationsBlock({
  client,
  selectedLocationId,
  readOnly,
  onSelectLocation,
  onSaveLocation,
}: LocationsBlockProps) {
  const locations = client.locations;
  const hasLocations = locations.length > 0;

  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isPrimary) ??
    locations[0] ??
    null;

  // Selected is "empty" only when BOTH address and map URL are blank —
  // a Maps-link-only location is still a valid filled location.
  const emptySelected =
    !!selectedLocation &&
    !selectedLocation.address &&
    !selectedLocation.mapUrl;
  const autoMode: FormMode =
    !hasLocations || emptySelected ? "edit" : "hidden";
  const [userMode, setUserMode] = useState<FormMode | null>(null);
  const mode: FormMode = userMode ?? autoMode;

  const [editingTargetId, setEditingTargetId] = useState<string | null>(
    selectedLocation?.id ?? null
  );
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMapUrl, setNewMapUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Keep the form fields synced with whichever location the block
  // decides to edit. Rule: when entering edit mode, prefill from the
  // target location; when entering add mode, blank it out.
  useEffect(() => {
    if (mode === "edit") {
      const target =
        locations.find((l) => l.id === editingTargetId) ?? selectedLocation;
      if (target && editingTargetId !== target.id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditingTargetId(target.id);
      }
      if (target) {
        // Legacy seed label "Основной" is the system's placeholder —
        // blank it on entry so the preset chips read as the default
        // choice and the user can pick Дом / Квартира etc. without
        // having to clear first.
        const seedLabel = target.label === "Основной" && !target.address;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewLabel(seedLabel ? "" : target.label ?? "");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewAddress(target.address ?? "");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewMapUrl(target.mapUrl ?? "");
      }
    }
    // Intentionally do NOT prefill from target when mode === "add" —
    // the +Объект handler already resets the fields.
  }, [mode, editingTargetId, selectedLocation, locations]);

  const resetForm = () => {
    setNewLabel("");
    setNewAddress("");
    setNewMapUrl("");
  };

  const openAdd = () => {
    resetForm();
    setEditingTargetId(null);
    setUserMode("add");
  };

  const openEdit = () => {
    setEditingTargetId(selectedLocation?.id ?? null);
    setUserMode("edit");
    // Effect above will prefill the form from selectedLocation.
  };

  const cancelForm = () => {
    resetForm();
    setEditingTargetId(null);
    setUserMode("hidden");
  };

  const saveForm = () => {
    const addr = newAddress.trim();
    const mapUrl = newMapUrl.trim();
    const lbl = newLabel.trim();
    // Нужен хотя бы один из: адрес, Maps URL, или осмысленный label.
    if (!addr && !mapUrl && !lbl) return;

    if (mode === "edit" && editingTargetId) {
      const existing = locations.find((l) => l.id === editingTargetId);
      if (existing) {
        onSaveLocation({
          ...existing,
          label: lbl || existing.label || "Объект",
          address: addr,
          mapUrl: mapUrl || undefined,
          // Preserve legacy acUnits silently; form no longer edits it.
        });
      }
    } else {
      const loc: Location = {
        id: generateId("loc"),
        label: lbl || "Объект",
        address: addr,
        mapUrl: mapUrl || undefined,
        acUnits: 0,
        isPrimary: !hasLocations,
      };
      onSaveLocation(loc);
    }
    resetForm();
    setEditingTargetId(null);
    setUserMode("hidden");
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
      // clipboard unavailable — swallow silently
    }
  };

  // Cancel button is only helpful when cancelling would actually take
  // the user somewhere useful. Auto-edit (no filled address yet) has
  // nothing to fall back to — hide it.
  const cancellable = userMode !== null;
  const formVisible = mode !== "hidden";
  const formIsEdit = mode === "edit";

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
                // Live preview while the user is editing this exact
                // location — chip label follows the form input so
                // switching a preset chip feels instant.
                const livePreview =
                  mode === "edit" && editingTargetId === loc.id;
                const shown = livePreview
                  ? newLabel.trim() || loc.label || "Объект"
                  : loc.label || "Объект";
                return (
                  <button
                    key={loc.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      onSelectLocation(loc.id);
                      if (userMode !== null) setUserMode(null);
                    }}
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
                      {shown}
                    </div>
                  </button>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex-shrink-0 min-w-[88px] px-3 py-2 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50"
                >
                  + Объект
                </button>
              )}
            </div>
          </>
        )}

        {/* Display panel — shown once the selected location has
            either a street address OR a Maps URL. */}
        {hasLocations &&
          !formVisible &&
          selectedLocation &&
          (selectedLocation.address || selectedLocation.mapUrl) && (
            <>
              <div className="h-px bg-slate-100 mx-3" />
              <div className="px-3 py-3">
                <div className="flex items-start gap-2 text-[14px] text-slate-900">
                  <span className="flex-shrink-0 mt-0.5 text-rose-500">
                    <PinIcon />
                  </span>
                  <span className="flex-1 leading-snug truncate">
                    {selectedLocation.address ||
                      (selectedLocation.mapUrl ? "Google Maps ссылка" : "")}
                  </span>
                </div>
                <div className="mt-2 ml-6 flex items-center gap-4 text-[13px] font-semibold">
                  <button
                    type="button"
                    onClick={openMaps}
                    className="inline-flex items-center gap-1 text-sky-700 active:opacity-60"
                  >
                    <MapIcon /> Карты
                  </button>
                  {selectedLocation.address && (
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 text-slate-600 active:opacity-60"
                    >
                      <CopyIcon /> {copied ? "Скопировано" : "Копировать"}
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="ml-auto inline-flex items-center gap-1 text-slate-500 active:opacity-60"
                    >
                      <PencilIcon /> Изменить
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

        {/* Form — edit existing selected loc or add a new one. */}
        {formVisible && !readOnly && (
          <>
            {hasLocations && <div className="h-px bg-slate-100 mx-3" />}
            <div className="px-3 py-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {formIsEdit
                  ? hasLocations
                    ? "Редактирование объекта"
                    : "Адрес объекта"
                  : "Новый объект"}
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
                placeholder="Своё название (необязательно)"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {/* Google Maps URL is the primary input — диспетчеру
                  обычно кидают ссылку, а не улицу. */}
              <input
                type="url"
                value={newMapUrl}
                onChange={(e) => setNewMapUrl(e.target.value)}
                placeholder="Google Maps ссылка"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Улица, дом (необязательно)"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-2 pt-1">
                {cancellable && (
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="flex-1 h-10 rounded-lg text-slate-600 font-medium"
                  >
                    Отмена
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveForm}
                  disabled={
                    !newAddress.trim() && !newLabel.trim() && !newMapUrl.trim()
                  }
                  className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.98] disabled:opacity-40"
                >
                  Сохранить
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
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
