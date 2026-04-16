"use client";

interface QuickActionsProps {
  phone?: string;
  address?: string;
}

// Блок 8. Позвонить + Навигация. Обе кнопки ≥ 56px высотой —
// крупные touch targets для бригадира на выезде.
export default function QuickActions({ phone, address }: QuickActionsProps) {
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  const mapsHref = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : undefined;

  return (
    <div className="px-4 pt-3 grid grid-cols-2 gap-2">
      <a
        href={phoneDigits ? `tel:${phoneDigits}` : undefined}
        onClick={(e) => { if (!phoneDigits) e.preventDefault(); }}
        className={`min-h-[56px] rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition ${
          phoneDigits
            ? "bg-emerald-500 text-white active:bg-emerald-600"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
        </svg>
        Позвонить
      </a>
      <a
        href={mapsHref}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => { if (!mapsHref) e.preventDefault(); }}
        className={`min-h-[56px] rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition ${
          mapsHref
            ? "bg-sky-500 text-white active:bg-sky-600"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        Навигация
      </a>
    </div>
  );
}
