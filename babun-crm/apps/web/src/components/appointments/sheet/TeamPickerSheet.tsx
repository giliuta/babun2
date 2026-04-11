"use client";

import type { Team } from "@/lib/masters";
import BottomSheet from "./BottomSheet";

interface TeamPickerSheetProps {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  selectedId: string | null;
  onSelect: (teamId: string) => void;
}

export default function TeamPickerSheet({
  open,
  onClose,
  teams,
  selectedId,
  onSelect,
}: TeamPickerSheetProps) {
  const activeTeams = teams.filter((t) => t.active);

  return (
    <BottomSheet open={open} onClose={onClose} title="Выбрать бригаду">
      <div className="p-4 space-y-2">
        {activeTeams.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            Нет активных бригад
          </div>
        ) : (
          activeTeams.map((t) => {
            const selected = t.id === selectedId;
            const letter = t.name.slice(0, 1).toUpperCase();
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 active:scale-[0.99] transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-[15px]"
                  style={{ backgroundColor: t.color || "#f59e0b" }}
                >
                  {letter}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[14px] font-medium text-gray-900 truncate">
                    {t.name}
                  </div>
                  {t.region && (
                    <div className="text-[12px] text-gray-500 truncate">
                      {t.region}
                    </div>
                  )}
                </div>
                {selected && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
