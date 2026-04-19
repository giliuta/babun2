"use client";

import { useState } from "react";
import type { Client, Location } from "@/lib/clients";
import AddressPickerSheet from "./AddressPickerSheet";
import MapNavPopup from "./MapNavPopup";

interface LocationsBlockProps {
  client: Client | null;
  selectedLocationId: string | null;
  readOnly?: boolean;
  addressNote: string;
  onSelectLocation: (id: string) => void;
  onAddressNoteChange: (note: string) => void;
}

// Address block layout (consistent across states):
//   [📍 адрес клиента                            ▸]
//   [🧭          Навигация                        ]   ← full-width button
//   [Примечание: дом, этаж, квартира…             ]   ← small inline text
export default function LocationsBlock({
  client,
  selectedLocationId,
  readOnly,
  addressNote,
  onSelectLocation,
  onAddressNoteChange,
}: LocationsBlockProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const locations: Location[] = client?.locations ?? [];
  const selected =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isPrimary) ??
    locations[0] ??
    null;

  const hasAddress = Boolean(selected && (selected.address || selected.mapUrl));
  const clientLocked = !client;

  const addressText = hasAddress
    ? selected?.address || (selected?.mapUrl ? "Google Maps ссылка" : "")
    : "";
  const labelText = hasAddress ? selected?.label ?? "" : "";
  const navInput = selected?.mapUrl || selected?.address || "";

  const openPicker = () => {
    if (readOnly || clientLocked) return;
    setPickerOpen(true);
  };

  return (
    <div className="px-4 pt-2">
      <div
        className={`rounded-xl bg-white border border-slate-200 overflow-hidden ${
          clientLocked ? "opacity-60" : ""
        }`}
      >
        {/* Address row */}
        <button
          type="button"
          disabled={readOnly || clientLocked}
          onClick={openPicker}
          className={`w-full h-12 flex items-center gap-2 px-3 ${
            !clientLocked && !readOnly ? "active:bg-slate-50" : ""
          }`}
        >
          <span className="flex-shrink-0 text-rose-500">
            <PinIcon />
          </span>
          {clientLocked ? (
            <span className="flex-1 text-left text-[13px] font-medium text-slate-400 truncate">
              Сначала выберите клиента
            </span>
          ) : hasAddress ? (
            <span className="flex-1 min-w-0 text-left text-[14px] text-slate-900 truncate">
              {addressText}
              {labelText && (
                <span className="text-slate-400 ml-1">· {labelText}</span>
              )}
            </span>
          ) : (
            <span className="flex-1 text-left text-[14px] font-medium text-violet-600">
              Добавить адрес
            </span>
          )}
          {!clientLocked && !readOnly && (
            <span className="flex-shrink-0 text-slate-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          )}
        </button>

        <div className="h-px bg-slate-100" />

        {/* Full-width Nav button */}
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

        {/* Always-visible small note input */}
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
      </div>

      {client && (
        <AddressPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          client={client}
          selectedLocationId={selectedLocationId}
          onPick={onSelectLocation}
        />
      )}
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
