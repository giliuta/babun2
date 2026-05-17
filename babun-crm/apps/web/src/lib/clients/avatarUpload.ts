// Avatar upload helper — Sprint clients-99 (F3.5).
//
// Layout:  client-avatars/{tenant_id}/{client_id}.{ext}
// We always overwrite (`upsert: true`) so a client never accumulates
// stale versions; the previous file is replaced atomically.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

const BUCKET = "client-avatars";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

type DbSupabase = SupabaseClient<Database>;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface AvatarUploadResult {
  /** Public URL ready for <img src>. */
  publicUrl: string;
  /** Storage object key — store this on the row if you ever switch
   *  to signed URLs. */
  path: string;
}

export class AvatarUploadError extends Error {}

export async function uploadClientAvatar(
  supabase: DbSupabase,
  args: {
    tenantId: string;
    clientId: string;
    file: File;
  },
): Promise<AvatarUploadResult> {
  const { tenantId, clientId, file } = args;
  if (!tenantId) throw new AvatarUploadError("tenantId is required");
  if (!clientId) throw new AvatarUploadError("clientId is required");
  if (file.size > MAX_BYTES) {
    throw new AvatarUploadError("Файл слишком большой (макс. 2 МБ)");
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new AvatarUploadError(
      "Поддерживаются только PNG / JPG / WebP / GIF",
    );
  }

  const path = `${tenantId}/${clientId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw new AvatarUploadError(`upload: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so an immediate re-upload shows the new bytes.
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  return { publicUrl, path };
}

export async function deleteClientAvatar(
  supabase: DbSupabase,
  args: { tenantId: string; clientId: string; ext?: string },
): Promise<void> {
  const { tenantId, clientId, ext } = args;
  // We don't know the ext when called from a "clear avatar" button —
  // delete all candidate extensions in one shot.
  const exts = ext ? [ext] : Object.values(EXT_BY_MIME);
  const paths = exts.map((e) => `${tenantId}/${clientId}.${e}`);
  await supabase.storage.from(BUCKET).remove(paths);
  // We ignore the error here — `remove` returns ok for missing files
  // anyway and a stale URL on `clients.avatar_url` is more harmful
  // than a noisy 404 in the network tab.
}
