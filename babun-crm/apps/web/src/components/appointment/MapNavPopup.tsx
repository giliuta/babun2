"use client";

import { buildMapUrl } from "@/lib/map-links";

interface MapNavPopupProps {
  open: boolean;
  onClose: () => void;
  /** Что искать — адрес клиента или Google Maps URL. */
  input: string;
}

// Small centered popup that lets the crew pick where to open the
// address: Google / Apple / Waze. One tap lands on the native app
// via deep link; if the user had pasted a Maps URL we route Google
// to the URL as-is, others fall back to a text search.
export default function MapNavPopup({ open, onClose, input }: MapNavPopupProps) {
  if (!open) return null;

  const openIn = (service: "google" | "apple" | "waze") => {
    const url = buildMapUrl(service, input);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    onClose();
  };

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
          Открыть в картах
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => openIn("google")}
            className="w-full h-11 rounded-xl bg-[rgba(62,136,247,0.08)] border border-[var(--separator)] text-[14px] font-semibold text-[var(--system-blue)] active:bg-[rgba(62,136,247,0.14)] flex items-center justify-center gap-2"
          >
            <span>🗺</span> Google Maps
          </button>
          <button
            type="button"
            onClick={() => openIn("apple")}
            className="w-full h-11 rounded-xl bg-[var(--fill-tertiary)] border border-[var(--separator)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-primary)] flex items-center justify-center gap-2"
          >
            <span>📍</span> Apple Maps
          </button>
          <button
            type="button"
            onClick={() => openIn("waze")}
            className="w-full h-11 rounded-xl bg-[var(--accent-tint)] border border-[var(--accent)]/30 text-[14px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)] flex items-center justify-center gap-2"
          >
            <span>🚗</span> Waze
          </button>
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
