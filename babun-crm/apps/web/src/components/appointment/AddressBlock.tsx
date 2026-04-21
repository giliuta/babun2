"use client";

interface AddressBlockProps {
  address: string;
  askHref?: string;
}

// Блок 4. Если адрес есть — синяя карточка с навигацией.
// Если нет — amber warning + кнопка «Спросить».
export default function AddressBlock({ address, askHref }: AddressBlockProps) {
  if (address) {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    return (
      <div className="px-4 pt-3">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-3 rounded-xl bg-[rgba(62,136,247,0.08)] border border-[rgba(62,136,247,0.25)] active:bg-[rgba(62,136,247,0.14)]"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[rgba(62,136,247,0.14)] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-[14px] text-[var(--label)] truncate">
              {address}
            </div>
          </div>
          <div className="text-[11px] text-[var(--system-blue)] font-semibold mt-1 ml-10">
            Открыть навигацию →
          </div>
        </a>
      </div>
    );
  }
  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.25)]">
        <div className="text-[13px] text-[var(--system-orange)] flex-1">
          ⚠️ Адрес не указан
        </div>
        {askHref && (
          <a
            href={askHref}
            className="h-8 px-3 rounded-lg bg-[rgba(255,149,0,0.08)]0 text-white text-[12px] font-semibold flex items-center active:bg-[var(--system-orange)] flex-shrink-0"
          >
            Спросить
          </a>
        )}
      </div>
    </div>
  );
}
