"use client";

import { useEffect, useState } from "react";
import {
  buildMapUrl,
  extractCoords,
  isLikelyUrl,
  resolveMapLink,
  type MapService,
} from "@babun/shared/common/utils/map-links";

interface MapNavPopupProps {
  open: boolean;
  onClose: () => void;
  /** Что открывать — текстовый адрес или ссылка (Google/Waze/Apple/Яндекс). */
  input: string;
}

const NAV_KEY = "babun2:nav-app";

const APPS: { id: MapService; name: string; emoji: string }[] = [
  { id: "google", name: "Google Maps", emoji: "🗺" },
  { id: "apple", name: "Apple Maps", emoji: "📍" },
  { id: "waze", name: "Waze", emoji: "🚗" },
  { id: "yandex", name: "Яндекс Карты", emoji: "🧭" },
];

function loadDefaultApp(): MapService {
  if (typeof window === "undefined") return "google";
  const s = window.localStorage.getItem(NAV_KEY);
  return s === "apple" || s === "waze" || s === "yandex" ? s : "google";
}

// Centered popup to open the address in the crew's navigator. Four apps;
// the last-used one is remembered (localStorage) and shown first as the
// default. Short links (maps.app.goo.gl, Waze, etc.) are resolved to
// coordinates server-side so any app — not just the link's native one —
// gets a working deep link.
export default function MapNavPopup({ open, onClose, input }: MapNavPopupProps) {
  const [busy, setBusy] = useState<MapService | null>(null);
  const [defaultApp, setDefaultApp] = useState<MapService>("google");

  useEffect(() => {
    if (open) setDefaultApp(loadDefaultApp());
  }, [open]);

  if (!open) return null;

  const openIn = async (service: MapService) => {
    if (busy) return;
    setBusy(service);
    let coords = extractCoords(input);
    if (!coords && isLikelyUrl(input)) {
      coords = await resolveMapLink(input);
    }
    const url = buildMapUrl(service, input, coords);
    try {
      window.localStorage.setItem(NAV_KEY, service);
    } catch {
      // ignore storage failures
    }
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener");
    onClose();
  };

  const ordered = [...APPS].sort((a, b) =>
    a.id === defaultApp ? -1 : b.id === defaultApp ? 1 : 0,
  );

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[14px] font-semibold text-[var(--label)] py-2">
          Открыть в навигаторе
        </div>
        <div className="pt-2 space-y-2">
          {ordered.map((app) => {
            const isDefault = app.id === defaultApp;
            return (
              <button
                key={app.id}
                type="button"
                disabled={busy !== null}
                onClick={() => openIn(app.id)}
                className={`w-full h-11 rounded-xl border flex items-center justify-center gap-2 text-[14px] font-semibold transition ${
                  isDefault
                    ? "bg-[var(--accent-tint)] border-[var(--accent)]/40 text-[var(--accent)]"
                    : "bg-[var(--fill-tertiary)] border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-primary)]"
                } ${busy && busy !== app.id ? "opacity-40" : ""}`}
              >
                <span>{app.emoji}</span>
                {busy === app.id ? "Открываю…" : app.name}
                {isDefault && busy === null && (
                  <span className="text-[11px] font-medium text-[var(--label-secondary)]">
                    · по умолчанию
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 mt-2 rounded-xl text-[13px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)]"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
