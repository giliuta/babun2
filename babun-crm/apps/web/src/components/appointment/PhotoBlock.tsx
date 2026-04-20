"use client";

import { useState } from "react";
import type { AppointmentPhoto, PhotoKind } from "@/lib/appointments";
import { compressImage, generateCaption } from "@/lib/photos";
import { generateId } from "@/lib/masters";
import PhotoPicker from "./PhotoPicker";
import PhotoViewer from "./PhotoViewer";

interface PhotoBlockProps {
  photos: AppointmentPhoto[];
  readonly: boolean;
  /** Used to auto-fill caption ('До · 14:35 · Спальня'). */
  locationLabel?: string;
  onChange: (next: AppointmentPhoto[]) => void;
}

const MAX_PHOTOS = 5;

// Thin thumbnail row + "+" chip; empty state is a full-width dashed
// button. Tapping a thumbnail opens the fullscreen PhotoViewer.
export default function PhotoBlock({
  photos,
  readonly,
  locationLabel,
  onChange,
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
    if (photos.length >= MAX_PHOTOS) {
      flashToast(`Максимум ${MAX_PHOTOS} фото на запись`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      const now = new Date();
      const photo: AppointmentPhoto = {
        id: generateId("photo"),
        data_url: dataUrl,
        kind,
        caption: generateCaption(kind, locationLabel, now),
        taken_at: now.toISOString(),
        uploaded_at: now.toISOString(),
      };
      onChange([...photos, photo]);
      flashToast("Фото добавлено");
    } catch (e) {
      flashToast(e instanceof Error ? e.message : "Не удалось добавить фото");
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = (id: string) => {
    const removed = photos.find((p) => p.id === id);
    if (!removed) return;
    onChange(photos.filter((p) => p.id !== id));
    setViewerIndex(null);
    // Simple undo path — re-add to the original spot. 5 seconds.
    const backupIndex = photos.findIndex((p) => p.id === id);
    let undone = false;
    setToast(null);
    const undoBanner = "Фото удалено · Вернуть";
    setToast(undoBanner);
    const timer = window.setTimeout(() => {
      if (!undone) setToast(null);
    }, 5000);
    undoHandler.current = () => {
      clearTimeout(timer);
      undone = true;
      const next = [...photos];
      next.splice(backupIndex, 0, removed);
      onChange(next);
      setToast("Фото возвращено");
      window.setTimeout(() => setToast(null), 1500);
    };
  };

  const rekindPhoto = (id: string, kind: PhotoKind) => {
    onChange(
      photos.map((p) =>
        p.id === id
          ? { ...p, kind, caption: generateCaption(kind, locationLabel, new Date(p.taken_at ?? p.uploaded_at)) }
          : p,
      ),
    );
  };

  const setCaption = (id: string, caption: string) => {
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const undoHandler = { current: null as null | (() => void) };

  // Read-only + empty → hide the block entirely.
  if (readonly && photos.length === 0) return null;

  return (
    <div className="px-4 pt-2">
      {photos.length === 0 ? (
        <button
          type="button"
          disabled={readonly || busy}
          onClick={() => setPickerOpen(true)}
          className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          📷 {busy ? "Сохраняем…" : "Добавить фото"}
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
          {!readonly && photos.length < MAX_PHOTOS && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
              aria-label="Добавить фото"
              className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-violet-300 text-violet-500 text-[22px] font-bold flex items-center justify-center active:bg-violet-50 disabled:opacity-40"
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
                ? "bg-slate-900 text-white active:bg-slate-800"
                : "bg-slate-100 text-slate-700"
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
          onDelete={deletePhoto}
          onRekind={rekindPhoto}
          onCaptionChange={setCaption}
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
  photo: AppointmentPhoto;
  onTap: () => void;
  disabled?: boolean;
}) {
  const badgeCls =
    photo.kind === "before"
      ? "bg-rose-500"
      : photo.kind === "after"
      ? "bg-emerald-500"
      : null;
  const badgeText =
    photo.kind === "before" ? "До" : photo.kind === "after" ? "После" : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      className="flex-shrink-0 relative w-16 h-16 rounded-xl overflow-hidden bg-slate-200 active:scale-[0.98] disabled:opacity-40"
      style={{ touchAction: "manipulation" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.data_url}
        alt={photo.caption}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      {badgeCls && badgeText && (
        <span
          className={`absolute top-0.5 left-0.5 h-4 px-1.5 rounded-full ${badgeCls} text-white text-[9px] font-bold flex items-center`}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
}
