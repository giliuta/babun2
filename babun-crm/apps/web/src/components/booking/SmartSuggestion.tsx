"use client";

import type { ServicePreset } from "@/lib/service-presets";
import { priceForPreset } from "@/lib/service-presets";

interface SmartSuggestionProps {
  preset: ServicePreset;
  onApply: () => void;
}

// Фиолетовый градиентный баннер со Sparkles. Появляется в
// ClientMode когда у выбранного объекта есть acUnits > 0, а
// услуга ещё не выбрана. Один тап применяет пресет.
export default function SmartSuggestion({ preset, onApply }: SmartSuggestionProps) {
  const price = priceForPreset(preset);
  return (
    <button
      type="button"
      onClick={onApply}
      className="w-full mx-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left active:scale-[0.99] transition"
      style={{
        width: "calc(100% - 2rem)",
        background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        boxShadow: "0 2px 8px -1px rgba(139,92,246,0.35)",
      }}
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {/* Sparkles */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5">
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
          <path d="M18 14l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-white/80 leading-tight">Рекомендуем</div>
        <div className="text-[14px] font-semibold text-white truncate">
          {preset.label}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[14px] font-bold text-white tabular-nums">€{price}</div>
        <div className="text-[10px] text-white/70 tabular-nums">{preset.duration} мин</div>
      </div>
    </button>
  );
}
