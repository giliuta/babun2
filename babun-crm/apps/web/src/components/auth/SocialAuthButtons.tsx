"use client";

// STORY-072 — OAuth buttons (Google + Apple).
//
// Hidden by default. Each provider is gated by a build-time env flag:
//   NEXT_PUBLIC_AUTH_GOOGLE=1  → Google button visible
//   NEXT_PUBLIC_AUTH_APPLE=1   → Apple button visible
//
// Set the flag only AFTER configuring the matching provider in
// Supabase Dashboard → Authentication → Providers. Without provider
// config the auth endpoint returns "Unsupported provider" 400, which
// looks like a broken app to the user. So: no flag → no button.
//
// Apple requires Apple Developer Program ($99/year) + Service ID +
// signing key. Google needs only a free Cloud Console OAuth client.

import { useState } from "react";
import { signInWithApple, signInWithGoogle } from "@/lib/supabase/auth-client";

interface Props {
  variant?: "login" | "register";
}

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
const APPLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_APPLE === "1";

export default function SocialAuthButtons({ variant = "login" }: Props) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Both providers off → render nothing, including the divider in the
  // parent card. The page falls back to "just email/password" cleanly.
  if (!GOOGLE_ENABLED && !APPLE_ENABLED) return null;

  const handle = async (provider: "google" | "apple") => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    const fn = provider === "google" ? signInWithGoogle : signInWithApple;
    const { ok, error: err } = await fn();
    if (!ok) {
      setError(err ?? "Не удалось подключиться");
      setBusy(null);
    }
    // On success the browser navigates away — no cleanup needed.
  };

  const verb = variant === "register" ? "Регистрация" : "Войти";

  return (
    <div className="space-y-2 mb-3">
      {GOOGLE_ENABLED && (
        <button
          type="button"
          onClick={() => handle("google")}
          disabled={!!busy}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-white border border-[var(--separator)] text-[#3c4043] text-[15px] font-semibold active:bg-[#f1f3f4] disabled:opacity-50 transition flex items-center justify-center gap-2.5"
        >
          <GoogleIcon />
          {busy === "google" ? "Подключаемся…" : `${verb} через Google`}
        </button>
      )}
      {APPLE_ENABLED && (
        <button
          type="button"
          onClick={() => handle("apple")}
          disabled={!!busy}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-black text-white text-[15px] font-semibold active:opacity-80 disabled:opacity-50 transition flex items-center justify-center gap-2.5"
        >
          <AppleIcon />
          {busy === "apple" ? "Подключаемся…" : `${verb} через Apple`}
        </button>
      )}
      {error && (
        <div className="text-[12px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 384 512"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
