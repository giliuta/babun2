"use client";

// P2 #43 (CRM Core brief) — single source of save state.
//
// Forms across Babun were each tracking their own ad-hoc {saving,
// saved, error} booleans, and several rendered «Сохраняем…» AND
// «Сохранено ✓» at once because the flip from one to the other
// wasn't ordered. This hook collapses the whole thing into a tagged
// union so the UI never has to ask «which message wins right now».
//
// Usage:
//
//   const save = useSaveStatus();
//   const onSubmit = () => save.run(async () => {
//     await upsertClient(draft);
//   });
//   <button disabled={save.status === "saving"}>
//     {save.label("Сохранить")}
//   </button>
//   {save.indicator()}
//
// `run` returns the wrapped promise so callers can chain post-save
// navigation (`router.replace(...)`) while still getting the saved-
// or-error state reflected in the UI.

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveState {
  status: SaveStatus;
  error: string | null;
}

export interface UseSaveStatusReturn {
  status: SaveStatus;
  error: string | null;
  /** Wrap an async action. Sets status=saving immediately; on resolve
   *  flips to saved (and clears after `savedTimeoutMs`); on reject
   *  flips to error and stores the message. */
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  /** Button-label helper: returns the active-state text or the
   *  passed default. Keeps every caller's button JSX one-liner. */
  label: (idleLabel: string) => string;
  /** Optional inline indicator chip. Renders nothing in idle and
   *  saved-then-cleared; renders a small line of text otherwise.
   *  Callers can ignore this and use `status` directly. */
  indicator: () => string | null;
  /** Manually reset to idle (useful after navigation). */
  reset: () => void;
}

interface Options {
  /** How long to show «Сохранено ✓» before flipping back to idle. */
  savedTimeoutMs?: number;
}

export function useSaveStatus(options: Options = {}): UseSaveStatusReturn {
  const { savedTimeoutMs = 1800 } = options;
  const [state, setState] = useState<SaveState>({ status: "idle", error: null });
  const timerRef = useRef<number | null>(null);

  // Clear pending timer on unmount; otherwise the setState lands on
  // a stale component and React logs the usual warning.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    clearTimer();
    setState({ status: "idle", error: null });
  }, []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      clearTimer();
      setState({ status: "saving", error: null });
      try {
        const result = await fn();
        setState({ status: "saved", error: null });
        timerRef.current = window.setTimeout(() => {
          setState({ status: "idle", error: null });
          timerRef.current = null;
        }, savedTimeoutMs);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Не удалось сохранить";
        setState({ status: "error", error: msg });
        return undefined;
      }
    },
    [savedTimeoutMs],
  );

  const label = useCallback(
    (idleLabel: string): string => {
      switch (state.status) {
        case "saving":
          return "Сохраняем…";
        case "saved":
          return "Сохранено";
        default:
          return idleLabel;
      }
    },
    [state.status],
  );

  const indicator = useCallback((): string | null => {
    switch (state.status) {
      case "saving":
        return "Сохраняем…";
      case "saved":
        return "Сохранено ✓";
      case "error":
        return state.error ?? "Ошибка";
      default:
        return null;
    }
  }, [state.status, state.error]);

  return {
    status: state.status,
    error: state.error,
    run,
    label,
    indicator,
    reset,
  };
}
