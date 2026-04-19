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

// Address block with stable height across states:
//   no client       → header row + greyed sub-row, same total height
//   client, empty   → header row + "+ Добавить" sub-row
//   client + addr   → header row (address) + Nav / Note sub-row
// Pressing "Примечание" flips the sub-row into a 2-line textarea
// inside the same card, so the card grows only when the user
// explicitly asks for it.
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
  const [noteOpen, setNoteOpen] = useState(false);

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

  const rowClass = "h-12 flex items-center gap-2 px-3";

  return (
    <div className="px-4 pt-2">
      <div
        className={`rounded-xl bg-white border border-slate-200 overflow-hidden ${
          clientLocked ? "opacity-60" : ""
        }`}
      >
        {/* Row 1: address (or placeholder) */}
        <button
          type="button"
          disabled={readOnly || clientLocked}
          onClick={openPicker}
          className={`w-full ${rowClass} ${
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

        {/* Row 2: navigation + note toggle. Disabled chips when no address. */}
        <div className={`${rowClass} gap-2`}>
          <button
            type="button"
            disabled={!hasAddress}
            onClick={() => setNavOpen(true)}
            className={`flex-1 h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 border ${
              hasAddress
                ? "bg-sky-50 border-sky-200 text-sky-800 active:bg-sky-100"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span>🧭</span> Навигация
          </button>
          <button
            type="button"
            disabled={readOnly || clientLocked}
            onClick={() => setNoteOpen((v) => !v)}
            className={`flex-1 h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 border ${
              addressNote.trim()
                ? "bg-amber-50 border-amber-200 text-amber-800 active:bg-amber-100"
                : clientLocked
                ? "bg-slate-50 border-slate-200 text-slate-400"
                : noteOpen
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-white border-dashed border-slate-200 text-slate-500 active:bg-slate-50"
            }`}
          >
            <span>📝</span>
            {addressNote.trim() ? "Примечание" : "+ Примечание"}
          </button>
        </div>

        {/* Optional: expanded note textarea */}
        {noteOpen && !readOnly && !clientLocked && (
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
