"use client";

// v541 §5.1 — top-level error boundary. Next.js wraps the whole app
// in this component when any rendering throws. Two things happen
// here:
//
//   1. The error is forwarded to the telemetry façade so Sentry (or
//      whatever adapter is installed) captures it with full stack +
//      digest. The default no-op means we don't crash deploys that
//      haven't wired Sentry yet.
//   2. The user sees a recoverable «Что-то сломалось» screen with a
//      «Перезагрузить» action that calls Next's reset() handler.
//
// Wrapping pattern: this is the App Router's special `global-error.tsx`
// file — it replaces the default 500 page for client-side runtime
// errors. Keep it minimal; the fancier «Не нашли страницу» 404 page
// lives in `app/not-found.tsx` (separate concern, owned by §2.6).

import { useEffect } from "react";
import { captureException } from "@/lib/observability/telemetry";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  // The boundary fires on every render path that throws, so we
  // capture once on mount + on any error-identity change. Sentry
  // dedupes by stack so spam from a bouncing render is fine.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    captureException(error, {
      subsystem: "react",
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100dvh",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
          background: "#f4f4f7",
          color: "#1c1c1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "calc(100vw - 32px)",
            padding: 24,
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              margin: "0 auto 16px",
              background: "rgba(255,59,48,0.08)",
              color: "#ff3b30",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
            aria-hidden
          >
            !
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Что-то сломалось
          </h1>
          <p
            style={{
              margin: "8px 0 20px",
              fontSize: 14,
              lineHeight: 1.45,
              color: "#6e6e73",
            }}
          >
            Мы уже знаем об ошибке. Можете перезагрузить страницу — обычно
            это помогает.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: "none",
              background: "#3e88f7",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Перезагрузить
          </button>
          {error.digest && (
            <div
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#a1a1a6",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
