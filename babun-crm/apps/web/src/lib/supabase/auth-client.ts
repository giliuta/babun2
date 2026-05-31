"use client";

// Auth client helpers (STORY-037).
//
// Thin wrappers around supabase.auth.* so the auth pages have one
// surface to import from and we can swap providers without touching
// every form. All functions return the Supabase result objects
// unchanged; pages decide how to render `error` vs `data`.

import { getSupabaseBrowser } from "./client";
import { wipeLocalData } from "@/lib/sync/auth-clear";

export interface AuthResult {
  ok: boolean;
  error: string | null;
}

function unwrap(error: { message: string } | null): AuthResult {
  if (!error) return { ok: true, error: null };
  return { ok: false, error: error.message };
}

export async function signUp(
  email: string,
  password: string,
  businessName?: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: businessName ? { business_name: businessName } : undefined,
    },
  });
  if (error) return unwrap(error);
  // STORY-038 — re-mint the JWT so app_metadata.tenant_id stamped by
  // handle_new_user() lands in the claims. Without this, the first
  // session post-signup falls back to current_tenant_id()'s DB lookup
  // on every query (one extra hit per request) until the user
  // re-authenticates.
  await supabase.auth.refreshSession();
  return unwrap(null);
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return unwrap(error);
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowser();
  // CROSS-TENANT LEAK FIX: wipe this device's local data (localStorage +
  // IndexedDB cache + sync queue) BEFORE the Supabase signOut, so the
  // next account signing in on this device can never inherit it. Awaited
  // so the wipe finishes before the caller redirects to /login.
  // Best-effort — never block logout on a wipe failure.
  try {
    await wipeLocalData();
  } catch {
    /* swallow — logout must still proceed */
  }
  await supabase.auth.signOut();
}

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  return unwrap(error);
}

export async function updatePassword(
  newPassword: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return unwrap(error);
}

export async function resendConfirmation(email: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  return unwrap(error);
}

// ─── STORY-072 — OAuth (Google / Apple) ──────────────────────────
//
// Both providers must be enabled in Supabase Dashboard →
// Authentication → Providers. Google needs a Client ID / Secret
// from Google Cloud Console. Apple needs an Apple Developer
// Program membership ($99/year) and a Service ID + key.
//
// signInWithOAuth navigates the browser away to the provider; the
// promise resolves only on error before redirect. The auth/callback
// route exchanges the returned `code` for a session.
//
// `prompt=select_account` (Google) / `response_mode=form_post` +
// `prompt=login` (Apple) — both providers will ALWAYS show the
// account-picker / consent screen, even if the browser already has an
// active session with that provider. Without this, a user clicking
// "Войти через Google" on a device where you happen to be logged into
// Google would silently sign in as YOU, not them. With it, the user
// is forced to choose which account they want and re-authenticate.
export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/auth/callback?next=/dashboard/clients",
      queryParams: { prompt: "select_account" },
    },
  });
  return unwrap(error);
}

export async function signInWithApple(): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: window.location.origin + "/auth/callback?next=/dashboard/clients",
      queryParams: { prompt: "login" },
    },
  });
  return unwrap(error);
}

