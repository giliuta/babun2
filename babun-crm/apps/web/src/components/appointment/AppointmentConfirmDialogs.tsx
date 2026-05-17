"use client";

// v615 — Centered confirm dialogs for AppointmentSheet:
//   • CloseConfirmDialog — fires on backdrop/Esc/✕ when the form
//     is dirty (red «Не сохранять» promoted as primary intent;
//     «Сохранить» only enabled when the form satisfies canSave).
//   • AskClientFirstDialog — fires when the dispatcher taps a
//     service before picking a client.
// Extracted from AppointmentSheet (Sprint #4 §9 pass 3).

interface CloseConfirmDialogProps {
  open: boolean;
  mode: "create" | "edit" | "view" | "done";
  canSave: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function CloseConfirmDialog({
  open,
  mode,
  canSave,
  onCancel,
  onDiscard,
  onSave,
}: CloseConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[17px] font-semibold tracking-tight text-[var(--label)] py-2">
          {mode === "edit" ? "Закрыть без сохранения?" : "Закрыть запись?"}
        </div>
        <div className="px-1 pt-1 pb-2 text-center text-[12px] text-[var(--label-secondary)]">
          {canSave
            ? "Введённые данные не сохранятся."
            : "Не хватает данных для сохранения — закрыть форму?"}
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onDiscard}
            className="w-full h-11 rounded-[10px] bg-[var(--system-red)] text-white text-[15px] font-semibold active:scale-[0.99] transition"
          >
            Не сохранять
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

interface AskClientFirstDialogProps {
  open: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onPickClient: () => void;
}

export function AskClientFirstDialog({
  open,
  onCancel,
  onContinue,
  onPickClient,
}: AskClientFirstDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[17px] font-semibold text-[var(--label)] py-2 px-1 leading-snug">
          Сначала выберите клиента
        </div>
        <div className="px-1 pb-2 text-center text-[12px] text-[var(--label-secondary)]">
          Услуги привяжутся к нужному клиенту.
        </div>
        <div className="pt-3 flex gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] active:bg-[var(--fill-secondary)]"
          >
            Без клиента
          </button>
          <button
            type="button"
            onClick={onPickClient}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Выбрать клиента
          </button>
        </div>
      </div>
    </div>
  );
}
