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
