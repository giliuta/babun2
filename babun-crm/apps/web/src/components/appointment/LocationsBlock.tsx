"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client, Location } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";
import { extractAddressFromMapUrl, isLikelyUrl } from "@/lib/map-links";
import { useLocationLabels } from "@/app/dashboard/layout";

interface LocationsBlockProps {
  client: Client;
  selectedLocationId: string | null;
  readOnly?: boolean;
  onSelectLocation: (id: string) => void;
  onSaveLocation: (loc: Location) => void;
}

type FormMode = "hidden" | "add" | "edit";

// Simplified location block:
// - No "Объекты (N)" header when there's just one location
// - No "Редактирование объекта" / "Новый объект" headers
// - One smart field "Адрес или ссылка" instead of separate URL + Street
// - Custom label input removed — preset chips cover 99% of cases
export default function LocationsBlock({
  client,
  selectedLocationId,
  readOnly,
  onSelectLocation,
  onSaveLocation,
}: LocationsBlockProps) {
  const { locationLabels } = useLocationLabels();
  const labelPresets = useMemo(
    () => locationLabels.map((l) => l.name),
    [locationLabels]
  );

  const locations = client.locations;
  const hasLocations = locations.length > 0;
  const multipleLocations = locations.length > 1;

  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isPrimary) ??
    locations[0] ??
    null;

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
  const [newInput, setNewInput] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync form fields when entering edit mode.
  useEffect(() => {
    if (mode !== "edit") return;
    const target =
      locations.find((l) => l.id === editingTargetId) ?? selectedLocation;
    if (!target) return;
    if (editingTargetId !== target.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingTargetId(target.id);
    }
    // Legacy seed label "Основной" on an empty target acts as a
    // placeholder — blank it so preset chips read as the default.
    const seedLabel = target.label === "Основной" && !target.address;
    const lbl = seedLabel ? "" : target.label ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewLabel(lbl);
    // If the existing label isn't one of the presets, open the custom
    // input automatically so the user sees their text rather than an
    // empty form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMode(lbl !== "" && !labelPresets.includes(lbl));
    // Prefer address for the combined field; fall back to mapUrl.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewInput(target.address || target.mapUrl || "");
  }, [mode, editingTargetId, selectedLocation, locations, labelPresets]);

  const resetForm = () => {
    setNewLabel("");
    setNewInput("");
    setCustomMode(false);
  };

  const openAdd = () => {
    resetForm();
    setEditingTargetId(null);
    setUserMode("add");
  };

  const openEdit = () => {
    setEditingTargetId(selectedLocation?.id ?? null);
    setUserMode("edit");
  };

  const cancelForm = () => {
    resetForm();
    setEditingTargetId(null);
    setUserMode("hidden");
  };

  const saveForm = () => {
    const input = newInput.trim();
    const lbl = newLabel.trim();
    if (!input && !lbl) return;

    const isUrl = isLikelyUrl(input);
    // If the user pasted a Maps URL, store it as mapUrl and try to lift
    // a readable street out of it for the address field. If that fails,
    // address stays blank — UI falls back to "Google Maps ссылка".
    const mapUrl = isUrl ? input : undefined;
    const address = isUrl
      ? (extractAddressFromMapUrl(input) ?? "")
      : input;

    if (mode === "edit" && editingTargetId) {
      const existing = locations.find((l) => l.id === editingTargetId);
      if (existing) {
        onSaveLocation({
          ...existing,
          label: lbl || existing.label || "Объект",
          address,
          mapUrl,
        });
      }
    } else {
      const loc: Location = {
        id: generateId("loc"),
        label: lbl || "Объект",
        address,
        mapUrl,
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

  // Compact "Добавить адрес" button when the client has no locations.
  if (!hasLocations && readOnly) return null;
  if (!hasLocations && mode === "hidden") {
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={openAdd}
          className="w-full h-10 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[14px] font-semibold text-violet-600 active:bg-violet-50 flex items-center justify-center gap-2"
        >
          <PinIcon /> Добавить адрес
        </button>
      </div>
    );
  }

  const cancellable = userMode !== null;
  const formVisible = mode !== "hidden";

  return (
    <div className="px-4 pt-2">
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {/* Location chips — only when there's actually more than one */}
        {multipleLocations && (
          <div
            className="px-2 pt-3 pb-2 flex items-stretch gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {locations.map((loc) => {
              const active = loc.id === selectedLocation?.id;
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
        )}

        {/* View panel — one-line address with Maps / Edit / +Объект actions */}
        {!formVisible &&
          selectedLocation &&
          (selectedLocation.address || selectedLocation.mapUrl) && (
            <div className={`px-3 ${multipleLocations ? "pt-2" : "pt-3"} pb-3`}>
              <div className="flex items-start gap-2 text-[14px] text-slate-900">
                <span className="flex-shrink-0 mt-0.5 text-rose-500">
                  <PinIcon />
                </span>
                <span className="flex-1 leading-snug truncate">
                  {selectedLocation.address ||
                    (selectedLocation.mapUrl ? "Google Maps ссылка" : "")}
                  {selectedLocation.label && !multipleLocations && (
                    <span className="text-slate-400 ml-1">
                      · {selectedLocation.label}
                    </span>
                  )}
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
                {!readOnly && !multipleLocations && (
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex items-center gap-1 text-slate-500 active:opacity-60"
                  >
                    + Объект
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Edit/Add form — no headers, just chips + one field + buttons */}
        {formVisible && !readOnly && (
          <div className={`px-3 ${multipleLocations ? "pt-1" : "pt-3"} pb-3 space-y-2`}>
            <div className="flex flex-wrap gap-1.5">
              {labelPresets.map((lbl) => {
                const active = !customMode && newLabel === lbl;
                return (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setNewLabel(lbl);
                    }}
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
              <button
                type="button"
                onClick={() => {
                  if (customMode) {
                    setCustomMode(false);
                    if (!labelPresets.includes(newLabel)) setNewLabel("");
                  } else {
                    setCustomMode(true);
                    if (labelPresets.includes(newLabel)) setNewLabel("");
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
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Своё название (напр. «Склад»)"
                className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                autoFocus
              />
            )}
            <input
              type="text"
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              placeholder="Адрес или Google Maps ссылка"
              className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus={!customMode}
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
                disabled={!newInput.trim() && !newLabel.trim()}
                className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.98] disabled:opacity-40"
              >
                Сохранить
              </button>
            </div>
          </div>
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
