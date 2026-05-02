// STORY-053b — modal history stack.
//
// Hardware Back on Android (and iOS swipe-from-edge gesture in some
// PWA contexts) fires `popstate` on the window. By default Next's
// router would treat that as "go back to the previous URL" — which,
// when a modal is open, dismisses the wrong layer. The user expected
// "back closes the open sheet"; instead they get pushed off the page.
//
// This module gives modals a way to opt in:
//
//   const close = registerModalBack("appointment-sheet", () => sheet.close());
//   // ...later, when the sheet's own close button is tapped:
//   close();
//
// On `registerModalBack`, we push a sentinel history entry tagged with
// `{ babunModal: id }`. On `popstate`, the most recent registered
// handler whose entry matches `id` runs and unregisters itself; the
// browser keeps the original history line untouched.
//
// Why a stack instead of a single handler: nested sheets exist (open
// AppointmentSheet → tap a client row → ClientPicker on top). Hardware
// Back should peel off the topmost sheet first, then the next one, and
// only then navigate away.

let stack: Array<{ id: string; onPop: () => void }> = [];
let listenerAttached = false;

const STATE_KEY = "babunModal";

interface BabunHistoryState {
  [STATE_KEY]?: string;
}

function ensureListener(): void {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;

  window.addEventListener("popstate", (ev: PopStateEvent) => {
    if (stack.length === 0) return;

    // The popped state has *no* babunModal field — it's whatever the
    // app had before our entry. (After we pushState'd, history sat at
    // our marker; pressing back goes one step back, so the popstate
    // delivers the previous-state object.) Pop our top handler.
    const top = stack[stack.length - 1];
    stack = stack.slice(0, -1);

    try {
      top.onPop();
    } catch (err) {
      // Don't let a buggy handler block other modal closes.
      console.error("history-stack onPop failed", err);
    }

    // Stop here — let the browser's natural back finish the popstate.
    // We don't pushState again, so the history line is short by exactly
    // one entry compared to before the modal opened. That's fine; it's
    // identical to the state before registerModalBack ran.
    void ev;
  });
}

/** Register a back handler for an open modal. Pushes a sentinel
 *  history entry so a hardware Back fires popstate. The returned
 *  function is the programmatic-close path: call it from your own
 *  close button so we balance the history stack symmetrically. */
export function registerModalBack(id: string, onPop: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  ensureListener();

  const state: BabunHistoryState = { [STATE_KEY]: id };
  window.history.pushState(state, "");
  const entry = { id, onPop };
  stack = [...stack, entry];

  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    // Remove ourselves from the stack first so the popstate handler
    // doesn't fire onPop again on the way back.
    const idx = stack.lastIndexOf(entry);
    if (idx === -1) return; // already popped via hardware back
    stack = stack.filter((_, i) => i !== idx);
    // Walk history back one step to undo our pushState.
    window.history.back();
  };
}

/** Diagnostic — current stack depth. Used in tests / debugger. */
export function modalStackDepth(): number {
  return stack.length;
}
