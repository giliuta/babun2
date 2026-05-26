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
  mode: "create" | "edit";
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
  // v667 — three-button popup per user explicit ask: «вылазит всегда
  // поп ап сохранить не сохранять и отмена». Primary action ordering
  // follows Apple HIG / iOS conventions: the highlighted accent
  // button (Save) is on top because it's the «default» action;
  // destructive (Не сохранять) sits in red below; «Отмена» is the
  // bottom escape hatch with no styling weight.
  //
  // Backdrop tap → Отмена (stay on sheet). Same intent as the explicit
  // Cancel button so accidental backdrop tap NEVER loses data.
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[17px] font-semibold tracking-tight text-[var(--label)] py-2">
          {mode === "edit" ? "Закрыть запись?" : "Сохранить запись?"}
        </div>
        <div className="px-1 pt-1 pb-2 text-center text-[12px] text-[var(--label-secondary)]">
          {canSave
            ? "Можно сохранить или закрыть без сохранения."
            : "Не хватает данных, чтобы сохранить. Закрыть без сохранения?"}
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            data-testid="close-confirm-save"
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onDiscard}
            data-testid="close-confirm-discard"
            className="w-full h-11 rounded-[10px] bg-[var(--system-red)] text-white text-[15px] font-semibold active:scale-[0.99] transition"
          >
            Не сохранять
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="close-confirm-cancel"
            className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
          >
            Отмена
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

// v628 §9 step 6 — segment-toggle dirty guard (extracted from
// AppointmentSheet). Fires when the operator taps «Клиент» while
// the event branch has a non-empty draft; «Не сохранять» drops
// the draft and switches; «Назад» stays in event mode.
interface SegmentSwitchConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}

export function SegmentSwitchConfirmDialog({
  open,
  onCancel,
  onDiscard,
}: SegmentSwitchConfirmDialogProps) {
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
          Сменить на «Клиент»?
        </div>
        <div className="px-1 pt-1 pb-2 text-center text-[12px] text-[var(--label-secondary)]">
          Введённые данные события не сохранятся.
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
            onClick={onCancel}
            className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)] transition"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
