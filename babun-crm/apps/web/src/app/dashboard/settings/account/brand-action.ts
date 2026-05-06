"use server";

// STORY-074 — owner-only update for tenants brand + region fields.
//
// Single bulk-write action so the form can submit one round-trip.
// Each field is optional in the input — only provided keys are
// updated. Booking slug is normalised to lowercase + dash-only.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export interface BrandPatch {
  country?: string;
  currency?: "EUR" | "USD" | "RUB" | "UAH" | "GBP";
  booking_slug?: string | null;
  logo_url?: string | null;
  business_address?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  contact_telegram?: string | null;
  contact_instagram?: string | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

function normalizeSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!trimmed) return null;
  return trimmed;
}

export async function updateTenantBrand(patch: BrandPatch): Promise<Result> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (!tenantId) return { ok: false, error: "tenant_missing" };

  // Build the update object: only include keys present in the patch
  // so a partial submit doesn't NULL fields the user didn't touch.
  const update: Record<string, unknown> = {};
  if (patch.country !== undefined) {
    const c = patch.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return { ok: false, error: "Код страны: 2 буквы (CY, RU, UA…)" };
    update.country = c;
  }
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.booking_slug !== undefined) {
    const slug = normalizeSlug(patch.booking_slug);
    if (slug && !SLUG_RE.test(slug)) {
      return { ok: false, error: "Slug: латиница, цифры, дефис. От 2 до 32 символов" };
    }
    update.booking_slug = slug;
  }
  if (patch.logo_url !== undefined)
    update.logo_url = patch.logo_url?.trim() || null;
  if (patch.business_address !== undefined)
    update.business_address = patch.business_address?.trim() || null;
  if (patch.contact_phone !== undefined)
    update.contact_phone = patch.contact_phone?.trim() || null;
  if (patch.contact_email !== undefined)
    update.contact_email = patch.contact_email?.trim() || null;
  if (patch.contact_whatsapp !== undefined)
    update.contact_whatsapp = patch.contact_whatsapp?.trim() || null;
  if (patch.contact_telegram !== undefined)
    update.contact_telegram = patch.contact_telegram?.trim() || null;
  if (patch.contact_instagram !== undefined)
    update.contact_instagram = patch.contact_instagram?.trim() || null;

  if (Object.keys(update).length === 0) return { ok: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("tenants")
    .update(update)
    .eq("id", tenantId);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Этот slug уже занят другим тенантом" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/account/personal");
  revalidatePath("/dashboard");
  return { ok: true };
}
