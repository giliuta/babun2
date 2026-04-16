"use client";

import type { ServicePreset } from "@/lib/service-presets";
import { priceForPreset } from "@/lib/service-presets";
import { formatEUR } from "@/lib/money";

interface ServiceBlockProps {
  preset: ServicePreset | null;
  customLabel?: string;
  customPrice?: number;
  customDuration?: number;
  readonly: boolean;
  onPick?: () => void;
}

// Блок 5. Услуга + сумма. Если preset есть — компактная строка,
// иначе кнопка «Выбрать услугу».
export default function ServiceBlock({
  preset,
  customLabel,
  customPrice,
  customDuration,
  readonly,
  onPick,
}: ServiceBlockProps) {
  const label = preset?.label ?? customLabel;
  const price = preset ? priceForPreset(preset) : customPrice ?? 0;
  const duration = preset?.duration ?? customDuration;

  if (!label) {
    if (readonly) return null;
    return (
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={onPick}
          className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-white border-2 border-dashed border-slate-300 active:scale-[0.99]"
        >
          <span className="text-[14px] font-medium text-slate-500">
            Выбрать услугу
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div
        className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-slate-200 ${
          readonly ? "" : "cursor-pointer active:scale-[0.99]"
        }`}
        onClick={readonly ? undefined : onPick}
      >
        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-[15px]">
          🔧
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-slate-900 truncate">
            {label}
          </div>
          {duration != null && (
            <div className="text-[11px] text-slate-500 tabular-nums">
              {duration} мин
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[17px] font-bold text-emerald-700 tabular-nums">
            {formatEUR(price)}
          </div>
        </div>
        {!readonly && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </div>
  );
}
