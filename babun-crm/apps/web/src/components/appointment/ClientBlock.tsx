"use client";

import type { Client } from "@/lib/clients";

interface ClientBlockProps {
  client: Client | null;
  readonly: boolean;
  onPick?: () => void;
  onCreate?: () => void;
  onChange?: () => void;
  onEdit?: () => void;
  /** If provided, shows a small menu button (⋯) next to the phone icon. */
  onMenu?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Блок 2: карточка клиента. Три состояния:
// — пусто + readonly=false → кнопка выбрать + «+ Создать»
// — заполнен + readonly=false → аватар/имя/телефон + ✏️/✕
// — заполнен + readonly=true → аватар/имя/телефон (tel-link)
export default function ClientBlock({
  client,
  readonly,
  onPick,
  onCreate,
  onChange,
  onEdit,
  onMenu,
}: ClientBlockProps) {
  if (!client) {
    if (readonly) return null;
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={onPick}
          className="w-full h-14 flex items-center gap-3 px-3 rounded-xl bg-white border-2 border-dashed border-slate-300 active:scale-[0.99]"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0 text-[16px] font-bold">
            +
          </div>
          <span className="text-[14px] font-medium text-slate-500">
            Выбрать клиента
          </span>
        </button>
      </div>
    );
  }

  const phone = client.phone;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";

  return (
    <div className="px-4 pt-2">
      <div className="h-14 flex items-center gap-3 px-3 rounded-xl bg-white border border-slate-200">
        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[13px] flex-shrink-0">
          {initials(client.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-slate-900 truncate">
            {client.full_name}
          </div>
          {phone && (
            readonly ? (
              <a
                href={phoneDigits ? `tel:${phoneDigits}` : undefined}
                className="text-[13px] text-sky-700 tabular-nums truncate block"
              >
                {phone}
              </a>
            ) : (
              <div className="text-[13px] text-slate-500 tabular-nums truncate">
                {phone}
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {phone && phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              aria-label="Позвонить"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-emerald-600 active:bg-emerald-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </a>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label="Меню"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          )}
          {!readonly && !onMenu && onChange && (
            <button
              type="button"
              onClick={onChange}
              aria-label="Сменить"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
