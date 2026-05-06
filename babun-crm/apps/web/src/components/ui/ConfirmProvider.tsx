"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ConfirmDialog from "./ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

// App-wide confirm provider. Lets any component replace
// `window.confirm("Удалить?")` with `await confirm({ title: "Удалить?" })`.
// The dialog is centred (per the global modal rule) instead of the
// browser's native bottom-of-screen alert. Mount once in the dashboard
// layout so every page can `useConfirm()`.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (pending) {
      pending.resolve(result);
      setPending(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          title={pending.opts.title}
          message={pending.opts.message ?? ""}
          confirmLabel={pending.opts.confirmLabel ?? "Удалить"}
          cancelLabel={pending.opts.cancelLabel ?? "Отмена"}
          danger={pending.opts.danger ?? true}
          onConfirm={() => handleClose(true)}
          onClose={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async confirm function. Resolves to `true` when the user
 * taps the destructive button, `false` on cancel / backdrop / Escape.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Удалить запись?" })) doDelete();
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to native confirm so callers don't crash when the
    // provider isn't mounted yet (e.g. in storybook or tests). If
    // we ever see this fire in production it's a regression — the
    // provider is supposed to be mounted at the dashboard layout
    // root. Loud warning so we notice instead of silently shipping
    // a native confirm dialog to a real user.
    return async (opts) => {
      if (typeof window === "undefined") return false;
      console.warn(
        "[useConfirm] ConfirmProvider is not mounted — falling back to window.confirm. This is a regression; mount <ConfirmProvider> at the layout root.",
      );
      return window.confirm(opts.title);
    };
  }
  return ctx;
}
