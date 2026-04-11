"use client";

import {
  whatsappUrl,
  telegramUrl,
  instagramUrl,
  telUrl,
} from "@/lib/messenger-links";

interface MessengerButtonsProps {
  phone?: string;
  telegramUsername?: string;
  instagramUsername?: string;
  /** show the green phone icon in the same row */
  showPhone?: boolean;
  size?: "sm" | "md";
}

// Horizontal strip of messenger deep-link buttons. Each button is hidden
// when the target data is missing, so the strip collapses to just the
// channels the client actually uses.
export default function MessengerButtons({
  phone,
  telegramUsername,
  instagramUsername,
  showPhone = true,
  size = "md",
}: MessengerButtonsProps) {
  const tel = showPhone ? telUrl(phone) : null;
  const wa = whatsappUrl(phone);
  const tg = telegramUrl(telegramUsername, phone);
  const ig = instagramUrl(instagramUsername);

  if (!tel && !wa && !tg && !ig) return null;

  const cls =
    size === "sm"
      ? "w-8 h-8 rounded-full"
      : "w-9 h-9 rounded-full";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {tel && (
        <a
          href={tel}
          aria-label="Позвонить"
          onClick={(e) => e.stopPropagation()}
          className={`${cls} flex items-center justify-center bg-emerald-500 text-white active:scale-95 transition`}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          onClick={(e) => e.stopPropagation()}
          className={`${cls} flex items-center justify-center bg-[#25D366] text-white active:scale-95 transition`}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
        </a>
      )}
      {tg && (
        <a
          href={tg}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
          onClick={(e) => e.stopPropagation()}
          className={`${cls} flex items-center justify-center bg-[#229ED9] text-white active:scale-95 transition`}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821l.001-.001c.321-1.496-.541-2.081-1.527-1.714L1.114 10.247c-1.462.568-1.44 1.384-.249 1.752l5.535 1.723 12.856-8.09c.605-.402 1.155-.179.703.223z" />
          </svg>
        </a>
      )}
      {ig && (
        <a
          href={ig}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          onClick={(e) => e.stopPropagation()}
          className={`${cls} flex items-center justify-center text-white active:scale-95 transition`}
          style={{
            background:
              "radial-gradient(circle at 30% 110%, #ffd86b 0%, #fa8a3c 25%, #e6313b 50%, #c13584 75%, #833ab4 100%)",
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>
      )}
    </div>
  );
}
