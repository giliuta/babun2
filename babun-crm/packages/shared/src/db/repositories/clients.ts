// Clients repository — STORY-036 / STORY-038.
//
// Single bridge between the UI shape (`@babun/shared/local/clients`
// → `Client`) and the Supabase row shape (`Database['public']
// ['Tables']['clients']['Row']`). Every nested array field on the
// local Client lives in jsonb on the DB; the adapters below are the
// only place that knows the column ↔ field mapping.
//
// Tag membership is stored in the `client_tag_assignments` junction
// table; the repository hides this from callers — `Client.tag_ids`
// round-trips losslessly via a parallel query.
//
// STORY-038 — every function in this file expects a Supabase client
// authenticated as either `anon` (no session) or `authenticated`
// (session cookie). RLS keys off public.current_tenant_id() which
// reads JWT app_metadata.tenant_id (with a tenants-by-owner_user_id
// fallback for the fresh-signup race). The explicit `.eq('tenant_id',
// tenantId)` filter below is now redundant for security but kept as
// belt-and-suspenders + helps PostgREST pick a faster index path.
// Service role bypass is intentionally out of scope; admin/cron
// tasks live outside this module (none yet).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import type {
  ACUnit,
  AcquisitionSource,
  Client,
  ClientNote,
  ClientTag,
  Location,
  PhoneEntry,
  PropertyType,
} from "../../local/clients";

type DbSupabase = SupabaseClient<Database>;
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];
type TagRow = Database["public"]["Tables"]["client_tags"]["Row"];

// ─── Adapters ──────────────────────────────────────────────────

function asArray<T>(v: Json | null | undefined): T[] {
  return Array.isArray(v) ? (v as unknown as T[]) : [];
}

function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    whatsapp_phone: r.whatsapp_phone,
    email: r.email,
    sms_name: r.sms_name,
    telegram_username: r.telegram_username,
    instagram_username: r.instagram_username,

    balance: Number(r.balance ?? 0),
    discount: r.discount ?? 0,
    comment: r.comment,

    acquisition_source: (r.acquisition_source ?? "unknown") as AcquisitionSource,
    referred_by_client_id: r.referred_by_client_id,
    first_contact_date: r.first_contact_date,

    address: r.address,
    city: r.city,
    property_type: (r.property_type ?? "") as PropertyType | "",

    language: r.language ?? "",
    birthday: r.birthday,
    blacklisted: r.blacklisted,
    pinned_at: r.pinned_at,
    reminder_at: r.reminder_at,

    phones: asArray<PhoneEntry>(r.phones).map((p) => ({
      id: p.id,
      number: p.number,
      label: p.label,
      name: p.name,
    })),
    locations: asArray<Location>(r.locations).map((l) => ({
      id: l.id,
      label: l.label,
      address: l.address,
      mapUrl: l.mapUrl,
      isPrimary: l.isPrimary,
      note: l.note,
      equipment: asArray<ACUnit>(l.equipment as unknown as Json).map((u) => ({
        id: u.id,
        room: u.room,
        brand: u.brand,
        model: u.model,
        ac_type: u.ac_type ?? "split",
        has_indoor: u.has_indoor ?? true,
        has_outdoor: u.has_outdoor ?? true,
      })),
    })),
    notes: asArray<ClientNote>(r.notes).map((n) => ({
      id: n.id,
      text: n.text,
      created_at: n.created_at,
    })),
    equipment: asArray<ACUnit>(r.equipment).map((u) => ({
      id: u.id,
      room: u.room,
      brand: u.brand,
      model: u.model,
      ac_type: u.ac_type ?? "split",
      has_indoor: u.has_indoor ?? true,
      has_outdoor: u.has_outdoor ?? true,
    })),

    // Filled by parallel query against client_tag_assignments.
    tag_ids: [],

    phone_e164: r.phone_e164 ?? null,
    avatar_url: r.avatar_url ?? null,
    deleted_at: r.deleted_at ?? null,
    favorite_master_id: r.favorite_master_id ?? null,

    created_at: r.created_at,
  };
}

function clientToInsert(c: Client, tenantId: string): ClientInsert {
  return {
    id: c.id || undefined,
    tenant_id: tenantId,
    full_name: c.full_name,
    phone: c.phone ?? "",
    whatsapp_phone: c.whatsapp_phone ?? "",
    email: c.email ?? "",
    sms_name: c.sms_name ?? "",
    telegram_username: c.telegram_username ?? "",
    instagram_username: c.instagram_username ?? "",

    balance: c.balance ?? 0,
    discount: c.discount ?? 0,
    comment: c.comment ?? "",

    acquisition_source: c.acquisition_source ?? "unknown",
    referred_by_client_id: c.referred_by_client_id ?? null,
    first_contact_date: c.first_contact_date ?? null,

    address: c.address ?? "",
    city: c.city ?? "",
    property_type: c.property_type || "",

    language: c.language ?? null,
    birthday: c.birthday ?? "",
    blacklisted: c.blacklisted ?? false,
    pinned_at: c.pinned_at ?? null,
    reminder_at: c.reminder_at ?? null,

    phones: (c.phones ?? []) as unknown as Json,
    locations: (c.locations ?? []) as unknown as Json,
    notes: (c.notes ?? []) as unknown as Json,
    equipment: (c.equipment ?? []) as unknown as Json,

    phone_e164: c.phone_e164 ?? null,
    avatar_url: c.avatar_url ?? null,
    deleted_at: c.deleted_at ?? null,
    favorite_master_id: c.favorite_master_id ?? null,

    // Preserve the moment the form was created. If empty (legacy or
    // hand-built objects) fall back to DB default `now()`.
    created_at: c.created_at || undefined,
    // updated_at: handled by trigger
  };
}

function clientToUpdate(patch: Partial<Client>): ClientUpdate {
  const out: ClientUpdate = {};
  if (patch.full_name !== undefined) out.full_name = patch.full_name;
  if (patch.phone !== undefined) out.phone = patch.phone;
  if (patch.whatsapp_phone !== undefined) out.whatsapp_phone = patch.whatsapp_phone;
  if (patch.email !== undefined) out.email = patch.email;
  if (patch.sms_name !== undefined) out.sms_name = patch.sms_name;
  if (patch.telegram_username !== undefined) out.telegram_username = patch.telegram_username;
  if (patch.instagram_username !== undefined) out.instagram_username = patch.instagram_username;
  if (patch.balance !== undefined) out.balance = patch.balance;
  if (patch.discount !== undefined) out.discount = patch.discount;
  if (patch.comment !== undefined) out.comment = patch.comment;
  if (patch.acquisition_source !== undefined) out.acquisition_source = patch.acquisition_source;
  if (patch.referred_by_client_id !== undefined) out.referred_by_client_id = patch.referred_by_client_id;
  if (patch.first_contact_date !== undefined) out.first_contact_date = patch.first_contact_date;
  if (patch.address !== undefined) out.address = patch.address;
  if (patch.city !== undefined) out.city = patch.city;
  if (patch.property_type !== undefined) out.property_type = patch.property_type || "";
  if (patch.language !== undefined) out.language = patch.language || null;
  if (patch.birthday !== undefined) out.birthday = patch.birthday;
  if (patch.blacklisted !== undefined) out.blacklisted = patch.blacklisted;
  if (patch.pinned_at !== undefined) out.pinned_at = patch.pinned_at;
  if (patch.reminder_at !== undefined) out.reminder_at = patch.reminder_at;
  if (patch.phones !== undefined) out.phones = patch.phones as unknown as Json;
  if (patch.locations !== undefined) out.locations = patch.locations as unknown as Json;
  if (patch.notes !== undefined) out.notes = patch.notes as unknown as Json;
  if (patch.equipment !== undefined) out.equipment = patch.equipment as unknown as Json;
  if (patch.phone_e164 !== undefined) out.phone_e164 = patch.phone_e164 ?? null;
  if (patch.avatar_url !== undefined) out.avatar_url = patch.avatar_url ?? null;
  if (patch.deleted_at !== undefined) out.deleted_at = patch.deleted_at ?? null;
  if (patch.favorite_master_id !== undefined) out.favorite_master_id = patch.favorite_master_id ?? null;
  return out;
}

// ─── Public API ────────────────────────────────────────────────

export async function listClients(
  supabase: DbSupabase,
  tenantId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Client[]> {
  let query = supabase.from("clients").select("*").eq("tenant_id", tenantId);
  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }
  const { data: rows, error } = await query;
  if (error) throw new Error(`listClients: ${error.message}`);

  const { data: assigns, error: assignErr } = await supabase
    .from("client_tag_assignments")
    .select("client_id, tag_id")
    .eq("tenant_id", tenantId);
  if (assignErr) throw new Error(`listClients tags: ${assignErr.message}`);

  const tagsByClient = new Map<string, string[]>();
  for (const a of assigns ?? []) {
    const arr = tagsByClient.get(a.client_id) ?? [];
    arr.push(a.tag_id);
    tagsByClient.set(a.client_id, arr);
  }

  return (rows ?? []).map((r) => ({
    ...rowToClient(r),
    tag_ids: tagsByClient.get(r.id) ?? [],
  }));
}

export async function getClient(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<Client | null> {
  const { data: row, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`getClient: ${error.message}`);
  if (!row) return null;

  const { data: assigns, error: assignErr } = await supabase
    .from("client_tag_assignments")
    .select("tag_id")
    .eq("client_id", id)
    .eq("tenant_id", tenantId);
  if (assignErr) throw new Error(`getClient tags: ${assignErr.message}`);

  return {
    ...rowToClient(row),
    tag_ids: (assigns ?? []).map((a) => a.tag_id),
  };
}

export async function createClient(
  supabase: DbSupabase,
  input: Client,
  tenantId: string,
): Promise<Client> {
  const insert = clientToInsert(input, tenantId);
  const { data: row, error } = await supabase
    .from("clients")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw new Error(`createClient: ${error.message}`);

  if (input.tag_ids?.length) {
    const rows = input.tag_ids.map((tag_id) => ({
      client_id: row.id,
      tag_id,
      tenant_id: tenantId,
    }));
    const { error: tagErr } = await supabase
      .from("client_tag_assignments")
      .insert(rows);
    if (tagErr) throw new Error(`createClient tags: ${tagErr.message}`);
  }

  return { ...rowToClient(row), tag_ids: input.tag_ids ?? [] };
}

export async function updateClient(
  supabase: DbSupabase,
  id: string,
  patch: Partial<Client>,
  tenantId: string,
): Promise<Client> {
  const update = clientToUpdate(patch);
  const { data: row, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) throw new Error(`updateClient: ${error.message}`);

  // Tag diff — only if caller supplied tag_ids on the patch.
  if (patch.tag_ids !== undefined) {
    const desired = new Set(patch.tag_ids);
    const { data: current, error: curErr } = await supabase
      .from("client_tag_assignments")
      .select("tag_id")
      .eq("client_id", id)
      .eq("tenant_id", tenantId);
    if (curErr) throw new Error(`updateClient tags read: ${curErr.message}`);

    const currentSet = new Set((current ?? []).map((c) => c.tag_id));
    const toAdd = [...desired].filter((t) => !currentSet.has(t));
    const toRemove = [...currentSet].filter((t) => !desired.has(t));

    if (toRemove.length) {
      const { error: delErr } = await supabase
        .from("client_tag_assignments")
        .delete()
        .eq("client_id", id)
        .eq("tenant_id", tenantId)
        .in("tag_id", toRemove);
      if (delErr) throw new Error(`updateClient tags delete: ${delErr.message}`);
    }
    if (toAdd.length) {
      const insertRows = toAdd.map((tag_id) => ({
        client_id: id,
        tag_id,
        tenant_id: tenantId,
      }));
      const { error: insErr } = await supabase
        .from("client_tag_assignments")
        .insert(insertRows);
      if (insErr) throw new Error(`updateClient tags add: ${insErr.message}`);
    }

    return { ...rowToClient(row), tag_ids: [...desired] };
  }

  // Tags untouched — re-read for completeness.
  const { data: assigns } = await supabase
    .from("client_tag_assignments")
    .select("tag_id")
    .eq("client_id", id)
    .eq("tenant_id", tenantId);
  return {
    ...rowToClient(row),
    tag_ids: (assigns ?? []).map((a) => a.tag_id),
  };
}

export async function deleteClient(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`deleteClient: ${error.message}`);
  // Junction rows cascade via FK.
}

// ─── Soft-delete + restore (clients-99 F3.2) ───────────────────

export async function softDeleteClient(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`softDeleteClient: ${error.message}`);
}

export async function softDeleteClients(
  supabase: DbSupabase,
  ids: string[],
  tenantId: string,
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`softDeleteClients: ${error.message}`);
}

export async function restoreClient(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`restoreClient: ${error.message}`);
}

export async function restoreClients(
  supabase: DbSupabase,
  ids: string[],
  tenantId: string,
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null })
    .in("id", ids)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`restoreClients: ${error.message}`);
}

// ─── Duplicate guard (clients-99 F1.5) ─────────────────────────

export async function findClientByPhoneE164(
  supabase: DbSupabase,
  phoneE164: string,
  tenantId: string,
): Promise<Client | null> {
  if (!phoneE164) return null;
  const { data: row, error } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone_e164", phoneE164)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`findClientByPhoneE164: ${error.message}`);
  if (!row) return null;
  return { ...rowToClient(row), tag_ids: [] };
}

// ─── Tag CRUD ──────────────────────────────────────────────────

function rowToTag(r: TagRow): ClientTag {
  return { id: r.id, name: r.name, color: r.color };
}

export async function listClientTags(
  supabase: DbSupabase,
  tenantId: string,
): Promise<ClientTag[]> {
  const { data, error } = await supabase
    .from("client_tags")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw new Error(`listClientTags: ${error.message}`);
  return (data ?? []).map(rowToTag);
}

export async function createClientTag(
  supabase: DbSupabase,
  input: { name: string; color: string },
  tenantId: string,
): Promise<ClientTag> {
  const { data, error } = await supabase
    .from("client_tags")
    .insert({ tenant_id: tenantId, name: input.name, color: input.color })
    .select("*")
    .single();
  if (error) throw new Error(`createClientTag: ${error.message}`);
  return rowToTag(data);
}

export async function updateClientTag(
  supabase: DbSupabase,
  id: string,
  patch: { name?: string; color?: string },
  tenantId: string,
): Promise<ClientTag> {
  const { data, error } = await supabase
    .from("client_tags")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) throw new Error(`updateClientTag: ${error.message}`);
  return rowToTag(data);
}

export async function deleteClientTag(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from("client_tags")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`deleteClientTag: ${error.message}`);
}
