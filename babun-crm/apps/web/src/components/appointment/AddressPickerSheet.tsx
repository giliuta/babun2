"use client";

import { useEffect, useState } from "react";
import type { Client, Location } from "@/lib/clients";
import { upsertClient } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { extractAddressFromMapUrl, isLikelyUrl } from "@/lib/map-links";
import { useLocationLabels } from "@/app/dashboard/layout";

interface AddressPickerSheetProps {
  open: boolean;
  onClose: () => void;
  client: Client;
  selectedLocationId: string | null;
  onPick: (locationId: string) => void;
}

type Mode = "list" | "create";

export default function AddressPickerSheet({
  open,
  onClose,
  client,
  selectedLocationId,
  onPick,
}: AddressPickerSheetProps) {
  const { locationLabels } = useLocationLabels();
  const locations = client.locations;
  const emptyClient = locations.length === 0;

  const [mode, setMode] = useState<Mode>(emptyClient ? "create" : "list");
  const [label, setLabel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!open) return;
    const next: Mode = locations.length === 0 ? "create" : "list";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMode(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput("");
  }, [open, locations.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const presets = locationLabels.map((l) => l.name);

  const saveNew = () => {
    const addr = input.trim();
    const lbl = label.trim();
    if (!addr && !lbl) return;
    const isUrl = isLikelyUrl(addr);
    const mapUrl = isUrl ? addr : undefined;
    const address = isUrl ? (extractAddressFromMapUrl(addr) ?? "") : addr;
    const loc: Location = {
      id: generateId("loc"),
      label: lbl || "Объект",
      address,
      mapUrl,
      isPrimary: locations.length === 0,
    };
    upsertClient({ ...client, locations: [...locations, loc] });
    onPick(loc.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
          <div className="text-[14px] font-semibold text-slate-900">
            {mode === "create" ? "Новый адрес" : "Адрес клиента"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {mode === "list" ? (
            <div className="p-3 space-y-1.5">
              {locations.map((loc) => {
                const active = loc.id === selectedLocationId;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      onPick(loc.id);
                      onClose();
                    }}
                    className={`w-full flex items-start gap-2.5 p-3 rounded-xl border-[1.5px] text-left transition active:scale-[0.99] ${
                      active
                        ? "bg-violet-50 border-violet-500"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <span className="flex-shrink-0 mt-0.5 text-rose-500">
                      <PinIcon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                        {loc.label || "Объект"}
                      </div>
                      <div className="text-[12px] text-slate-500 truncate">
                        {loc.address || (loc.mapUrl ? "Google Maps ссылка" : "—")}
                      </div>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMode("create")}
                className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50 flex items-center justify-center gap-2"
              >
                <span className="text-[16px] leading-none">+</span> Новый адрес
              </button>
            </div>
          ) : (
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
                {!emptyClient && (
                  <button
                    type="button"
                    onClick={() => setMode("list")}
                    className="flex-1 h-11 rounded-xl text-slate-600 font-medium"
                  >
                    Назад
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={!input.trim() && !label.trim()}
                  className="flex-1 h-11 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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
