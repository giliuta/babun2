"use client";

// STORY-060 §F3.5 — bug-report channel.
//
// Small text link "Сообщить о баге". Tap opens a centered modal with
// email + message fields. Submit POSTs to /api/feedback, which either
// opens a GitHub Issue (when GITHUB_TOKEN is set) or falls back to a
// server log. Auto-attaches version, URL, viewport, and last 20
// console.error lines.

import { useCallback, useEffect, useRef, useState } from "react";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
import { useToast } from "@/components/ui/Toast";
import {
  installConsoleErrorBuffer,
  getRecentConsoleErrors,
} from "@/lib/observability/consoleErrorBuffer";

export interface BugReportButtonProps {
  /** Optional context label appended to the message. Defaults to
   *  current pathname. */
  pageLabel?: string;
}

export default function BugReportButton({ pageLabel }: BugReportButtonProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Install the console-error buffer lazily — idempotent.
  useEffect(() => {
    installConsoleErrorBuffer();
  }, []);

  // Lock body scroll while modal open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; backdrop closes only when both fields are empty.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the textarea on open.
  useEffect(() => {
    if (open) {
      const handle = window.setTimeout(() => textareaRef.current?.focus(), 0);
      return () => window.clearTimeout(handle);
    }
  }, [open]);

  const handleOpen = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
  }, [submitting]);

  const handleBackdrop = useCallback(() => {
    if (submitting) return;
    if (!email.trim() && !message.trim()) {
      setOpen(false);
    }
  }, [submitting, email, message]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = message.trim();
      if (!trimmed) {
        setError("Опишите проблему.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const label =
          pageLabel ??
          (typeof window !== "undefined"
            ? window.location.pathname
            : "");
        const fullMessage = label ? `${trimmed} — [${label}]` : trimmed;
        const payload = {
          email: email.trim() || undefined,
          message: fullMessage,
          version: BUILD_VERSION,
          url: typeof window !== "undefined" ? window.location.href : "",
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
          viewport: {
            w: typeof window !== "undefined" ? window.innerWidth : 0,
            h: typeof window !== "undefined" ? window.innerHeight : 0,
          },
          console_errors: getRecentConsoleErrors(),
        };
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        toast.show({
          variant: "success",
          message: "Спасибо! Сообщение отправлено.",
        });
        setEmail("");
        setMessage("");
        setOpen(false);
      } catch {
        toast.show({
          variant: "error",
          message: "Не получилось отправить. Попробуйте ещё раз.",
        });
        setError("Не получилось отправить. Попробуйте ещё раз.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, message, pageLabel, submitting, toast],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-[12px] text-[var(--label-tertiary)] underline active:opacity-70 transition"
      >
        Сообщить о баге
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          aria-modal="true"
          role="dialog"
          aria-label="Сообщить о баге"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleBackdrop}
          />
          <form
            onSubmit={handleSubmit}
            className="relative bg-[var(--surface-card)] rounded-[16px] shadow-[0_16px_48px_rgba(0,0,0,0.32)] border border-[var(--separator)] w-[min(420px,calc(100vw-32px))] p-5"
          >
            <div className="text-[17px] font-semibold text-[var(--label)] mb-1">
              Сообщить о баге
            </div>
            <div className="text-[13px] text-[var(--label-secondary)] mb-4">
              Опишите, что пошло не так. Мы добавим текущую версию и адрес автоматически.
            </div>

            <label className="block text-[12px] text-[var(--label-secondary)] mb-1">
              Email (необязательно)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              className="w-full h-10 px-3 rounded-[10px] border border-[var(--separator)] bg-[var(--surface-card)] text-[15px] text-[var(--label)] mb-3"
            />

            <label className="block text-[12px] text-[var(--label-secondary)] mb-1">
              Что произошло?
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Что произошло? Что вы делали до этого?"
              disabled={submitting}
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--separator)] bg-[var(--surface-card)] text-[15px] text-[var(--label)] resize-none"
            />

            {error && (
              <div className="text-[12px] text-[var(--system-red)] mt-2">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 h-11 rounded-[12px] bg-[var(--fill-quaternary)] text-[var(--label)] text-[15px] font-medium active:opacity-80 transition disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:opacity-80 transition disabled:opacity-50"
              >
                {submitting ? "Отправка…" : "Отправить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
