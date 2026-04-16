"use client";

interface AdminActionsProps {
  canReschedule: boolean; // только для pending
  onEdit: () => void;
  onReschedule?: () => void;
  onCancel: () => void;
}

// Блок 10. Список админ-действий для view/done. Каждый пункт
// полноширинная строка. Отмена — с confirm().
export default function AdminActions({
  canReschedule,
  onEdit,
  onReschedule,
  onCancel,
}: AdminActionsProps) {
  const confirmCancel = () => {
    if (window.confirm("Отменить запись?")) onCancel();
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
