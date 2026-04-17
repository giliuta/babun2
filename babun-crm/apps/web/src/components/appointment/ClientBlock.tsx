"use client";

import type { Client } from "@/lib/clients";

interface ClientBlockProps {
  client: Client | null;
  readonly: boolean;
  onPick?: () => void;
  onCreate?: () => void;
  onChange?: () => void;
  onEdit?: () => void;
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
}: ClientBlockProps) {
  if (!client) {
    if (readonly) return null;
    return (
      <div className="px-4 pt-3 space-y-2">
        <button
          type="button"
          onClick={onPick}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-white border-2 border-dashed border-slate-300 active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0 text-[18px] font-bold">
            +
          </div>
          <span className="text-[14px] font-medium text-slate-500">
            Выбрать клиента
          </span>
        </button>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="w-full h-10 rounded-xl bg-violet-50 text-violet-700 text-[13px] font-semibold active:bg-violet-100"
          >
            + Создать нового клиента
          </button>
        )}
      </div>
    );
  }

  const phone = client.phone;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-slate-200">
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
        {!readonly && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Редактировать"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
            {onChange && (
              <button
                type="button"
                onClick={onChange}
                aria-label="Сменить"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
