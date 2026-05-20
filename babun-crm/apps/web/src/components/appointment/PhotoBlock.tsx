"use client";

import { useState } from "react";
import { Camera } from "@babun/shared/icons";
import type { PhotoKind } from "@babun/shared/local/appointments";
import { compressImageToBlob, generateCaption, validatePhotoFile } from "@babun/shared/local/photos";
import {
  uploadPhoto,
  updatePhoto,
  deletePhoto as deletePhotoRepo,
  type AppointmentPhotoRecord,
} from "@babun/shared/db/repositories/appointment-photos";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import PhotoPicker from "./PhotoPicker";
import PhotoViewer from "./PhotoViewer";

interface PhotoBlockProps {
  photos: AppointmentPhotoRecord[];
  readonly: boolean;
  /** Server-side IDs needed to upload through the storage repo. */
  tenantId: string;
  appointmentId: string;
  /** Used to auto-fill caption ('До · 14:35 · Спальня'). */
  locationLabel?: string;
  onChange: (next: AppointmentPhotoRecord[]) => void;
  /** v671 — when false, the upload button is disabled with an inline
   *  hint asking the user to save the appointment first. This is the
   *  fix for the photo-orphan bug: in create mode `appointmentId` is
   *  a fresh client-side UUID with no matching `appointments` row;
   *  uploading a photo writes to Storage + appointment_photos table
   *  immediately, but if the user closes via «Не сохранять» the
   *  appointment row never lands → photo references a phantom id
   *  forever. Defaults to true for backward compat. */
  canUpload?: boolean;
}

const MAX_PHOTOS = 5;

// STORY-049 — uploads go to Supabase Storage; metadata to DB.
// Server-side trigger enforces MAX_PHOTOS=5; the client UI cap below
// is a UX nicety so the disabled "+" button hints at the limit before
// the user tries to add a 6th.
export default function PhotoBlock({
  photos,
  readonly,
  tenantId,
  appointmentId,
  locationLabel,
  onChange,
  canUpload = true,
}: PhotoBlockProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const addPhoto = async (kind: PhotoKind, file: File) => {
    if (!canUpload) {
      // v671 — see canUpload prop comment. Defensive belt-and-braces;
      // the UI already disables PhotoPicker when canUpload=false.
      flashToast("Сохраните запись перед добавлением фото");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      flashToast(`Максимум ${MAX_PHOTOS} фото на запись`);
      return;
    }
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      flashToast(validation.reason ?? "Неподходящий файл");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImageToBlob(file);
      const now = new Date();
      const supabase = getSupabaseBrowser();
      const record = await uploadPhoto(supabase, {
        tenantId,
        appointmentId,
        file: blob,
        contentType: "image/jpeg",
        kind,
        caption: generateCaption(kind, locationLabel, now),
        takenAt: now.toISOString(),
      });
      onChange([...photos, record]);
      flashToast("Фото добавлено");
    } catch (e) {
      flashToast(e instanceof Error ? e.message : "Не удалось добавить фото");
    } finally {
      setBusy(false);
    }
  };

  const undoHandler = { current: null as null | (() => void) };

  const handleDelete = async (id: string) => {
    const removed = photos.find((p) => p.id === id);
    if (!removed) return;
    // Optimistic remove from local state; server delete via repo.
    const previous = photos;
    onChange(photos.filter((p) => p.id !== id));
    setViewerIndex(null);
    setToast("Удаляем фото…");
    try {
      const supabase = getSupabaseBrowser();
      await deletePhotoRepo(supabase, removed);
      setToast("Фото удалено · Вернуть");
      const timer = window.setTimeout(() => setToast(null), 5000);
      undoHandler.current = () => {
        // Undo path can't recover the storage object (already removed
        // by the repo). Skip the actual restore — best we can do is
        // restore the local state placeholder. The user notices the
        // image as broken and re-uploads if they want it back.
        clearTimeout(timer);
        onChange(previous);
        setToast("Восстановлено локально (фото из Storage уже удалено)");
        window.setTimeout(() => setToast(null), 2500);
      };
    } catch (err) {
      // Rollback the optimistic change.
      onChange(previous);
      flashToast(err instanceof Error ? err.message : "Не удалось удалить фото");
    }
  };

  const handleRekind = async (id: string, kind: PhotoKind) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    const caption = generateCaption(kind, locationLabel, new Date(photo.taken_at ?? photo.created_at));
    const optimistic = photos.map((p) =>
      p.id === id ? { ...p, kind, caption } : p,
    );
    onChange(optimistic);
    try {
      const supabase = getSupabaseBrowser();
      await updatePhoto(supabase, id, { kind, caption });
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Не удалось обновить фото");
    }
  };

  const handleCaption = async (id: string, caption: string) => {
    const optimistic = photos.map((p) => (p.id === id ? { ...p, caption } : p));
    onChange(optimistic);
    try {
      const supabase = getSupabaseBrowser();
      await updatePhoto(supabase, id, { caption });
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Не удалось сохранить подпись");
    }
  };

  if (readonly && photos.length === 0) return null;

  return (
    <div className="px-4 pt-2">
      {/* v671 — hint when upload is gated by «save first». Only shown
          on the empty state; once there are photos this row is hidden
          because canUpload=false also implies an existing record. */}
      {!readonly && !canUpload && photos.length === 0 && (
        <div className="mb-2 px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[12px] text-[var(--label-secondary)] text-center">
          Сохраните запись перед добавлением фото.
        </div>
      )}
      {photos.length === 0 ? (
        <button
          type="button"
          disabled={readonly || busy || !canUpload}
          onClick={() => setPickerOpen(true)}
          className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-[var(--accent)]/40 text-[13px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)] flex items-center justify-center gap-2 disabled:text-[var(--label-tertiary)] disabled:border-[var(--separator)] disabled:cursor-not-allowed"
        >
          <Camera size={16} strokeWidth={2} />
          {busy ? "Сохраняем…" : "Добавить фото"}
        </button>
      ) : (
        <div
          className="flex items-center gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none", touchAction: "pan-x" }}
        >
          {photos.map((p, i) => (
            <PhotoThumb
              key={p.id}
              photo={p}
              onTap={() => setViewerIndex(i)}
              disabled={busy}
            />
          ))}
          {!readonly && canUpload && photos.length < MAX_PHOTOS && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
              aria-label="Добавить фото"
              className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-[var(--accent)]/40 text-[var(--accent)] text-[22px] font-bold flex items-center justify-center active:bg-[var(--accent-tint)] disabled:text-[var(--label-tertiary)] disabled:border-[var(--separator)] disabled:cursor-not-allowed"
            >
              {busy ? "…" : "+"}
            </button>
          )}
        </div>
      )}

      {toast && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => {
              if (toast.includes("Вернуть") && undoHandler.current) {
                undoHandler.current();
                undoHandler.current = null;
              } else {
                setToast(null);
              }
            }}
            className={`inline-flex h-8 px-3 rounded-full text-[12px] font-semibold ${
              toast.includes("Вернуть")
                ? "bg-[var(--label)] text-[var(--label-on-accent)] active:bg-[var(--label)]"
                : "bg-[var(--fill-primary)] text-[var(--label)]"
            }`}
          >
            {toast}
          </button>
        </div>
      )}

      <PhotoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addPhoto}
      />

      {viewerIndex !== null && (
        <PhotoViewer
          open
          photos={photos}
          initialIndex={viewerIndex}
          readOnly={readonly}
          onClose={() => setViewerIndex(null)}
          onDelete={handleDelete}
          onRekind={handleRekind}
          onCaptionChange={handleCaption}
        />
      )}
    </div>
  );
}

function PhotoThumb({
  photo,
  onTap,
  disabled,
}: {
  photo: AppointmentPhotoRecord;
  onTap: () => void;
  disabled?: boolean;
}) {
  const badgeCls =
    photo.kind === "before"
      ? "bg-[var(--system-red)]"
      : photo.kind === "after"
      ? "bg-[var(--system-green)]"
      : null;
  const badgeText =
    photo.kind === "before" ? "До" : photo.kind === "after" ? "После" : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      className="flex-shrink-0 relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--fill-secondary)] active:scale-[0.98] disabled:opacity-40"
      style={{ touchAction: "manipulation" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption}
        loading="lazy"
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      {badgeCls && badgeText && (
        <span
          className={`absolute top-0.5 left-0.5 h-4 px-1.5 rounded-full ${badgeCls} text-[var(--label-on-accent)] text-[10px] font-bold flex items-center`}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
}
