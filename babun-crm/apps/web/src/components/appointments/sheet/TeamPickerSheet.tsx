"use client";

import type { Team } from "@babun/shared/local/masters";
import DialogModal from "./DialogModal";

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
    <DialogModal open={open} onClose={onClose} title="Выбрать бригаду">
      <div className="p-3 space-y-2">
        {activeTeams.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--label-tertiary)]">
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
                className={`w-full flex items-center gap-2.5 p-2.5 min-h-[48px] rounded-[10px] border active:scale-[0.99] transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-tint)]"
                    : "border-[var(--separator)] bg-[var(--surface-card)]"
                }`}
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px]"
                  style={{ backgroundColor: t.color || "#f59e0b" }}
                >
                  {letter}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[15px] font-medium text-[var(--label)] truncate">
                    {t.name}
                  </div>
                  {t.region && (
                    <div className="text-[12px] text-[var(--label-secondary)] truncate">
                      {t.region}
                    </div>
                  )}
                </div>
                {selected && (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
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
    </DialogModal>
  );
}
