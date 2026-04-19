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

// Compact address facade. Layout:
//
//   no client:      [📍  Выберите сначала клиента]     (grey, disabled)
//   client, empty:  [📍  Добавить адрес]                (tap → picker form)
//   client + loc:   [📍  Ул. Николау, 42 · Дом       ▸ ]  (tap → picker list)
//                   [🧭 Навигация]  [📝 Примечание]
//                   (note expands to textarea when tapped)
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
  const [noteOpen, setNoteOpen] = useState(Boolean(addressNote.trim()));

  const locations: Location[] = client?.locations ?? [];
  const selected =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isPrimary) ??
    locations[0] ??
    null;

  const hasAddress = Boolean(selected && (selected.address || selected.mapUrl));
  const clientLocked = !client;

  // Disabled placeholder row when no client picked yet.
  if (clientLocked) {
    return (
      <div className="px-4 pt-2">
        <div className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-400 flex items-center justify-center gap-2">
          <PinIcon />
          Выберите сначала клиента
        </div>
      </div>
    );
  }

  // Client picked but empty locations: single "+ Добавить адрес" tap.
  if (!hasAddress) {
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <PinIcon /> Добавить адрес
        </button>
        {client && (
          <AddressPickerSheet
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            client={client}
            selectedLocationId={selectedLocationId}
            onPick={onSelectLocation}
          />
        )}
      </div>
    );
  }

  // Filled address: tap row to change, navigation + note below.
  const addressText =
    selected?.address || (selected?.mapUrl ? "Google Maps ссылка" : "");
  const labelText = selected?.label || "";
  const navInput = selected?.mapUrl || selected?.address || "";

  return (
    <div className="px-4 pt-2">
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-start gap-2 px-3 py-2.5 active:bg-slate-50"
        >
          <span className="flex-shrink-0 mt-0.5 text-rose-500">
            <PinIcon />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[14px] text-slate-900 truncate">
              {addressText}
              {labelText && (
                <span className="text-slate-400 ml-1">· {labelText}</span>
              )}
            </div>
          </div>
          {!readOnly && (
            <span className="flex-shrink-0 text-slate-300 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          )}
        </button>

        <div className="h-px bg-slate-100 mx-3" />

        <div className="px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="flex-1 h-9 rounded-lg bg-sky-50 border border-sky-200 text-[12px] font-semibold text-sky-800 active:bg-sky-100 flex items-center justify-center gap-1.5"
          >
            <span>🧭</span> Навигация
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setNoteOpen((v) => !v)}
            className={`flex-1 h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 border ${
              noteOpen || addressNote.trim()
                ? "bg-amber-50 border-amber-200 text-amber-800 active:bg-amber-100"
                : "bg-white border-dashed border-slate-200 text-slate-500 active:bg-slate-50"
            }`}
          >
            <span>📝</span>
            {addressNote.trim() ? "Примечание" : "+ Примечание"}
          </button>
        </div>

        {noteOpen && !readOnly && (
          <div className="px-3 pb-3">
            <textarea
              value={addressNote}
              onChange={(e) => onAddressNoteChange(e.target.value)}
              placeholder="Зелёная дверь, звонок на 2-й этаж…"
              rows={2}
              autoFocus={!addressNote}
              className="w-full px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-900 placeholder-amber-400/70 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        )}

        {noteOpen && readOnly && addressNote.trim() && (
          <div className="px-3 pb-3">
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-900 whitespace-pre-wrap">
              {addressNote}
            </div>
          </div>
        )}
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
