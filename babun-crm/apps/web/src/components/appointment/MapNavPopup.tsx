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
        className="w-full max-w-[300px] bg-white rounded-2xl shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[14px] font-semibold text-slate-900 py-2">
          Открыть в картах
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => openIn("google")}
            className="w-full h-11 rounded-xl bg-sky-50 border border-sky-200 text-[14px] font-semibold text-sky-800 active:bg-sky-100 flex items-center justify-center gap-2"
          >
            <span>🗺</span> Google Maps
          </button>
          <button
            type="button"
            onClick={() => openIn("apple")}
            className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 text-[14px] font-semibold text-slate-800 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <span>📍</span> Apple Maps
          </button>
          <button
            type="button"
            onClick={() => openIn("waze")}
            className="w-full h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-[14px] font-semibold text-indigo-800 active:bg-indigo-100 flex items-center justify-center gap-2"
          >
            <span>🚗</span> Waze
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 mt-2 rounded-xl text-[13px] font-medium text-slate-500 active:bg-slate-50"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
