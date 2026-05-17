// Client attachments — Sprint clients-99 (F3.10).
//
// Bucket: client-attachments (private).
// Path:   {tenant_id}/{client_id}/{attachment_id}.{ext}
// Reads:  short-lived signed URLs (5 min) minted on demand.
// Writes: insert metadata row + upload bytes in two steps; if the
//         second fails we delete the orphan row.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

const BUCKET = "client-attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const SIGNED_URL_TTL = 5 * 60; // seconds

type DbSupabase = SupabaseClient<Database>;

export interface ClientAttachment {
  id: string;
  client_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export class AttachmentError extends Error {}

function extFromMime(mime: string, fallback: string): string {
  if (mime.startsWith("image/")) return mime.split("/")[1].replace("jpeg", "jpg");
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "txt";
  return fallback;
}

function safeExtFromName(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  return m ? m[1].toLowerCase() : "bin";
}

export async function listAttachments(
  supabase: DbSupabase,
  args: { tenantId: string; clientId: string },
): Promise<ClientAttachment[]> {
  const { data, error } = await supabase
    .from("client_attachments")
    .select("id, client_id, storage_path, filename, mime_type, size_bytes, created_at")
    .eq("tenant_id", args.tenantId)
    .eq("client_id", args.clientId)
    .order("created_at", { ascending: false });
  if (error) throw new AttachmentError(`list: ${error.message}`);
  return (data ?? []) as ClientAttachment[];
}

export async function uploadAttachment(
  supabase: DbSupabase,
  args: { tenantId: string; clientId: string; file: File },
): Promise<ClientAttachment> {
  const { tenantId, clientId, file } = args;
  if (file.size > MAX_BYTES) {
    throw new AttachmentError("Файл слишком большой (макс. 10 МБ)");
  }

  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ext = extFromMime(file.type || "", safeExtFromName(file.name));
  const path = `${tenantId}/${clientId}/${id}.${ext}`;

  const { data: row, error: insertErr } = await supabase
    .from("client_attachments")
    .insert({
      id,
      tenant_id: tenantId,
      client_id: clientId,
      storage_path: path,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    })
    .select("id, client_id, storage_path, filename, mime_type, size_bytes, created_at")
    .single();
  if (insertErr) throw new AttachmentError(`insert: ${insertErr.message}`);

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });
  if (uploadErr) {
    // Roll back the metadata row — orphan rows are worse than a
    // missing file (UI would show a thumbnail that 404s forever).
    await supabase.from("client_attachments").delete().eq("id", id);
    throw new AttachmentError(`upload: ${uploadErr.message}`);
  }

  return row as ClientAttachment;
}

export async function deleteAttachment(
  supabase: DbSupabase,
  args: { attachment: ClientAttachment; tenantId: string },
): Promise<void> {
  const { attachment, tenantId } = args;
  // Storage first — if metadata delete fails after, we have an
  // orphan row which the UI can re-cleanup. The reverse leaves a
  // mystery file the user can't see or remove.
  await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
  const { error } = await supabase
    .from("client_attachments")
    .delete()
    .eq("id", attachment.id)
    .eq("tenant_id", tenantId);
  if (error) throw new AttachmentError(`delete: ${error.message}`);
}

export async function getSignedUrl(
  supabase: DbSupabase,
  attachment: ClientAttachment,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new AttachmentError(`signedUrl: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

export function isImage(att: { mime_type: string }): boolean {
  return att.mime_type.startsWith("image/");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}
