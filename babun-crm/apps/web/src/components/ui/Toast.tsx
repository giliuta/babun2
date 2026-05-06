"use client";

// STORY-052 G5b — minimal toast surface for the dashboard.
//
// Three variants (info / success / error). Stack at bottom-center
// (thumb-zone on phone). Auto-dismiss after 4 seconds; manual
// dismiss via tap. Z-index 80 sits between modal sheets (70) and
// confirm dialogs (90), so a confirm-from-toast (rare) wins focus.
//
// API:
//   const toast = useToast();
//   toast.show({ variant: "success", message: "Подписка Pro активирована" });
//
// Mount the provider exactly once at the dashboard layout level.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "error";

export interface ToastOptions {
  variant?: ToastVariant;
  message: string;
  /** Defaults to 4000ms. Pass 0 to disable auto-dismiss. */
  durationMs?: number;
}

interface ToastEntry extends Required<Omit<ToastOptions, "durationMs">> {
  id: number;
  durationMs: number;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // Defensive fallback — keeps callers from crashing if the
  // provider isn't mounted yet (e.g. unit tests, Storybook). The
  // fallback no-ops; callers should treat showToast as best-effort.
  return { show: () => {} };
}

let _nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = _nextId++;
      const entry: ToastEntry = {
        id,
        variant: opts.variant ?? "info",
        message: opts.message,
        durationMs: opts.durationMs ?? 4000,
      };
      setItems((prev) => [...prev, entry]);
      if (entry.durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), entry.durationMs);
        timersRef.current.set(id, handle);
      }
    },
    [dismiss],
  );

  // Cleanup on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((h) => window.clearTimeout(h));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {items.length > 0 && (
        <div
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 z-[80] pointer-events-none flex flex-col gap-2 w-[min(92vw,420px)]"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 8px) + 80px)" }}
        >
          {items.map((t) => (
            <ToastPill key={t.id} entry={t} onClose={() => dismiss(t.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastPill({
  entry,
  onClose,
}: {
  entry: ToastEntry;
  onClose: () => void;
}) {
  const tone = (
    {
      info: "bg-[var(--surface-toast)] text-white",
      success:
        "bg-[var(--system-green,#34C759)] text-white",
      error: "bg-[var(--system-red,#FF3B30)] text-white",
    } as const
  )[entry.variant];

  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Закрыть уведомление"
      className={`pointer-events-auto rounded-[14px] px-4 py-3 text-left shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] active:opacity-80 transition ${tone}`}
    >
      <div className="text-[14px] leading-snug">{entry.message}</div>
    </button>
  );
}
