// Appointment photos repository — STORY-049.
//
// Bridge between the relational `public.appointment_photos` rows
// (metadata + storage_path) and the `AppointmentPhotoRecord` shape
// the UI consumes (with the public URL pre-resolved).
//
// Upload orchestration:
//   1. supabase.storage.from('appointment-photos').upload(path, blob)
//   2. supabase.from('appointment_photos').insert({...path...})
// On step 2 failure, best-effort storage.remove() to avoid orphan
// blob. On step 1 failure, nothing to clean up. Atomicity-across-the-
// two-steps is sacrificed for simplicity; the worst case (orphan
// blob) is reaped by the janitor (STORY-049a backlog).
//
// Delete orchestration (REVERSED per A3):
//   1. from('appointment_photos').delete().eq('id', ...)
//   2. supabase.storage.remove([path])
// Row goes first; if the storage call fails after, the blob orphans
// but the UI is consistent (no broken-image flash).
//
// MAX_PHOTOS=5 enforcement is server-side: the
// `appointment_photos_max_5` trigger raises 23514 on the 6th insert
// for a given appointment, with a FOR UPDATE on the parent
// appointment row to serialise concurrent inserts (decision A7).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["appointment_photos"]["Row"];

const BUCKET = "appointment-photos";

export type PhotoKind = "before" | "after" | "other";

export interface AppointmentPhotoRecord {
  id: string;
  appointment_id: string;
  tenant_id: string;
  storage_path: string;
  url: string;
  kind: PhotoKind;
  caption: string;
  location_id: string | null;
  taken_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UploadPhotoArgs {
  tenantId: string;
  appointmentId: string;
  file: Blob;
  contentType?: string;
  kind?: PhotoKind;
  caption?: string;
  locationId?: string | null;
  takenAt?: string | null;
}

function rowWithUrl(supabase: DbSupabase, r: Row): AppointmentPhotoRecord {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(r.storage_path);
  return {
    id: r.id,
    appointment_id: r.appointment_id,
    tenant_id: r.tenant_id,
    storage_path: r.storage_path,
    url: data.publicUrl,
    kind: (r.kind as PhotoKind) ?? "other",
    caption: r.caption,
    location_id: r.location_id,
    taken_at: r.taken_at,
    sort_order: r.sort_order,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** All photos for one appointment, sorted by sort_order then created_at. */
export async function listPhotosForAppointment(
  supabase: DbSupabase,
  appointmentId: string,
): Promise<AppointmentPhotoRecord[]> {
  const { data, error } = await supabase
    .from("appointment_photos")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPhotosForAppointment: ${error.message}`);
  return (data ?? []).map((r) => rowWithUrl(supabase, r as Row));
}

function pickExt(contentType: string | undefined, fileName?: string): string {
  if (contentType) {
    if (contentType === "image/jpeg") return "jpg";
    if (contentType === "image/png") return "png";
    if (contentType === "image/webp") return "webp";
  }
  if (fileName) {
    const m = /\.([a-z0-9]+)$/i.exec(fileName);
    if (m) return m[1].toLowerCase();
  }
  return "jpg";
}

/** Upload a blob + insert the row. Throws on storage failure (nothing
 *  inserted) or on row failure (best-effort blob cleanup). On success
 *  the returned record has the public URL ready for <img>. */
export async function uploadPhoto(
  supabase: DbSupabase,
  args: UploadPhotoArgs,
): Promise<AppointmentPhotoRecord> {
  const photoId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ext = pickExt(
    args.contentType ?? (args.file as File).type ?? undefined,
    (args.file as File).name,
  );
  const path = `${args.tenantId}/${args.appointmentId}/${photoId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, args.file, {
      contentType: args.contentType ?? (args.file as File).type ?? undefined,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (upErr) throw new Error(`uploadPhoto (storage): ${upErr.message}`);

  // Resolve the next sort_order in a single round-trip via a
  // count-then-insert. Race-prone but the trigger enforces the cap;
  // duplicates would just shift order, not break invariants.
  const { count } = await supabase
    .from("appointment_photos")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", args.appointmentId);

  try {
    const { data, error } = await supabase
      .from("appointment_photos")
      .insert({
        id: photoId,
        appointment_id: args.appointmentId,
        tenant_id: args.tenantId,
        storage_path: path,
        kind: args.kind ?? "other",
        caption: args.caption ?? "",
        location_id: args.locationId ?? null,
        taken_at: args.takenAt ?? null,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowWithUrl(supabase, data);
  } catch (err) {
    // Row insert failed — best-effort cleanup of the just-uploaded blob.
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      // ignore — janitor sweeps later
    }
    throw err instanceof Error
      ? new Error(`uploadPhoto (row): ${err.message}`)
      : new Error("uploadPhoto (row): unknown");
  }
}

export async function updatePhoto(
  supabase: DbSupabase,
  photoId: string,
  patch: Partial<{
    caption: string;
    kind: PhotoKind;
    location_id: string | null;
    sort_order: number;
  }>,
): Promise<AppointmentPhotoRecord> {
  const { data, error } = await supabase
    .from("appointment_photos")
    .update(patch)
    .eq("id", photoId)
    .select("*")
    .single();
  if (error) throw new Error(`updatePhoto: ${error.message}`);
  return rowWithUrl(supabase, data);
}

/** Delete the row first, then the storage object (REVERSED order
 *  per A3 — orphan blob ok, broken UI bad). Storage failure leaves
 *  an orphan blob; the row is gone, the UI no longer shows it. */
export async function deletePhoto(
  supabase: DbSupabase,
  photo: { id: string; storage_path: string },
): Promise<void> {
  const { error: rowErr } = await supabase
    .from("appointment_photos")
    .delete()
    .eq("id", photo.id);
  if (rowErr) throw new Error(`deletePhoto (row): ${rowErr.message}`);
  // Best-effort storage cleanup; ignore failure (janitor).
  try {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  } catch {
    // ignore — janitor sweeps later
  }
}

/** Bulk delete used by AppointmentSheet when the user deletes the
 *  whole appointment. Caller passes the captured paths so the FK
 *  CASCADE doesn't race the storage cleanup. */
export async function removeStorageObjects(
  supabase: DbSupabase,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
