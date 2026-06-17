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
// Incremented by popClose() right before each history.back() that exists
// only to consume its OWN sentinel. Those back()s schedule popstates that
// must be no-ops — the modal already closed via React state and popClose
// already cleaned the in-memory stack. Without this guard the deferred
// popstate ran the NEXT layer's onPop: closing an inner sheet via its own
// button also tore down the outer sheet, and opening the filter panel from
// a settings row (close-A-then-open-B in one commit) immediately closed
// the panel again. A counter (not a flag) so several programmatic closes
// in one tick each suppress exactly one popstate.
let pendingSelfPops = 0;

const STATE_KEY = "babunModal";

interface BabunHistoryState {
  [STATE_KEY]?: string;
}

function ensureListener(): void {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;

  window.addEventListener("popstate", (ev: PopStateEvent) => {
    // A popClose()-initiated back() just unwound its own sentinel — that
    // popstate is bookkeeping only; never run the next layer's onPop.
    if (pendingSelfPops > 0) {
      pendingSelfPops -= 1;
      return;
    }
    // Edge case — page reload while a modal was open. Our pushState
    // entries are persisted in the browser's session history, but the
    // in-memory `stack` is empty (modules re-initialised). Without this
    // guard, hardware Back walks the user backward through "ghost"
    // entries that no longer have handlers; nothing closes, nothing
    // navigates, app feels stuck. Detect by looking at the popped
    // state — if it carries `babunModal` and we have no live handler,
    // silent-skip backward until we land on a non-modal entry.
    const evState = (ev.state ?? null) as BabunHistoryState | null;
    if (stack.length === 0) {
      if (evState && evState[STATE_KEY]) {
        // Still on a stale modal entry → keep walking back. The browser
        // will fire another popstate; that one we can decide about then.
        try {
          window.history.back();
        } catch {
          // ignore — already at the bottom of history.
        }
      }
      return;
    }

    // Normal path: pop the top handler and run its onPop.
    const top = stack[stack.length - 1];
    stack = stack.slice(0, -1);

    try {
      top.onPop();
    } catch (err) {
      // Don't let a buggy handler block other modal closes.
      console.error("history-stack onPop failed", err);
    }
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

    // STORY-085 — only walk history back when our sentinel is the
    // current entry. If the user navigated away while the modal
    // was open (e.g. tapped a sidebar nav row that does router.push),
    // the new URL's state is on top, and an unconditional history.back
    // would undo the navigation, ping-ponging the user back to where
    // they came from. Detect by checking that the current state still
    // carries OUR id; if it doesn't, the navigation already moved past
    // our sentinel and there's nothing to unwind.
    const currentState = (window.history.state ?? null) as BabunHistoryState | null;
    if (currentState && currentState[STATE_KEY] === id) {
      // Pop our own sentinel from the browser history; the resulting
      // popstate is a no-op (see pendingSelfPops) so it can't close the
      // layer below us or a sibling modal opened in the same commit.
      pendingSelfPops += 1;
      window.history.back();
    }
  };
}

/** Diagnostic — current stack depth. Used in tests / debugger. */
export function modalStackDepth(): number {
  return stack.length;
}
