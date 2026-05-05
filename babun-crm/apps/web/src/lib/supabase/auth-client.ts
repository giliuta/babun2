"use client";

// Auth client helpers (STORY-037).
//
// Thin wrappers around supabase.auth.* so the auth pages have one
// surface to import from and we can swap providers without touching
// every form. All functions return the Supabase result objects
// unchanged; pages decide how to render `error` vs `data`.

import { getSupabaseBrowser } from "./client";

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
export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/auth/callback?next=/dashboard/clients",
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
    },
  });
  return unwrap(error);
}

// ─── STORY-072 — Email OTP (passwordless 6-digit code) ───────────
//
// User enters email → we call signInWithOtp → Supabase emails a
// 6-digit code. User enters the code into the verify form which
// calls verifyEmailOtp → session created, auto-redirect.
//
// shouldCreateUser=true so the same flow handles signup + login.
// Tenant provisioning trigger fires on the auth.users insert
// regardless of signup method.
export async function sendEmailOtp(email: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return unwrap(error);
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) return unwrap(error);
  await supabase.auth.refreshSession();
  return unwrap(null);
}

// ─── STORY-072 — Phone OTP (SMS code via Twilio) ─────────────────
//
// Requires Supabase Dashboard → Authentication → Providers → Phone
// to be enabled with Twilio creds (we already have them in Edge
// Function secrets — Supabase Auth uses a separate set). Phone is
// stored on auth.users.phone (E.164 format).
//
// Cost note: each SMS via Twilio ~€0.05–0.10. Rate-limit applied
// at Supabase level (default 1 SMS / 60s per phone).
export async function sendPhoneOtp(phone: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });
  return unwrap(error);
}

export async function verifyPhoneOtp(
  phone: string,
  token: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) return unwrap(error);
  await supabase.auth.refreshSession();
  return unwrap(null);
}
