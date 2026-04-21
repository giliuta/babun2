"use client";

import { useConfirm } from "@/components/ui/ConfirmProvider";

interface AdminActionsProps {
  canReschedule: boolean; // только для pending
  onEdit: () => void;
  onReschedule?: () => void;
  onCancel: () => void;
  onShare?: () => void;
}

// Блок 10. Список админ-действий для view/done. Каждый пункт
// полноширинная строка. Отмена — с confirm().
export default function AdminActions({
  canReschedule,
  onEdit,
  onReschedule,
  onCancel,
  onShare,
}: AdminActionsProps) {
  const confirm = useConfirm();
  const confirmCancel = async () => {
    if (await confirm({ title: "Отменить запись?", confirmLabel: "Отменить" })) {
      onCancel();
    }
  };

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <button
          type="button"
          onClick={onEdit}
          className="w-full px-4 py-3 text-left text-[14px] text-slate-800 active:bg-slate-50"
        >
          Редактировать
        </button>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="w-full px-4 py-3 text-left text-[14px] text-slate-800 border-t border-slate-100 active:bg-slate-50 flex items-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Поделиться с клиентом
          </button>
        )}
        {canReschedule && onReschedule && (
          <button
            type="button"
            onClick={onReschedule}
            className="w-full px-4 py-3 text-left text-[14px] text-slate-800 border-t border-slate-100 active:bg-slate-50"
          >
            Перенести
          </button>
        )}
        <button
          type="button"
          onClick={confirmCancel}
          className="w-full px-4 py-3 text-left text-[14px] text-rose-600 border-t border-slate-100 active:bg-rose-50"
        >
          Отменить запись
        </button>
      </div>
    </div>
  );
}
