"use client";

import { useEffect, useRef, useState } from "react";
import type { AppointmentPhoto, PhotoKind } from "@/lib/appointments";
import { kindLabel } from "@/lib/photos";

interface PhotoViewerProps {
  open: boolean;
  photos: AppointmentPhoto[];
  initialIndex: number;
  readOnly?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRekind: (id: string, kind: PhotoKind) => void;
  onCaptionChange: (id: string, caption: string) => void;
}

// Fullscreen photo viewer with swipe navigation. Kept independent
// of SwipeableCalendar so the calendar's two-finger cancel guard
// doesn't accidentally eat gallery swipes.
export default function PhotoViewer({
  open,
  photos,
  initialIndex,
  readOnly,
  onClose,
  onDelete,
  onRekind,
  onCaptionChange,
}: PhotoViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [captionEditing, setCaptionEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setCaptionEditing(false);
      setMenuOpen(false);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length, onClose]);

  if (!open || photos.length === 0) return null;
  const photo = photos[Math.min(Math.max(0, index), photos.length - 1)];
  if (!photo) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    // Bail out of swipe if finger started at the far-left iOS back-
    // swipe zone — that's the system gesture, let it through.
    if (t.clientX < 24) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 50) return;
    if (dx > 0 && index > 0) setIndex(index - 1);
    if (dx < 0 && index < photos.length - 1) setIndex(index + 1);
  };

  const saveCaption = () => {
    onCaptionChange(photo.id, captionDraft.trim());
    setCaptionEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar — caption + close */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 h-12 bg-black/40"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex-1 min-w-0">
          {captionEditing && !readOnly ? (
            <input
              autoFocus
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              onBlur={saveCaption}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setCaptionEditing(false);
              }}
              placeholder="Добавить подпись…"
              className="w-full h-9 px-2 rounded-lg bg-white/10 text-[var(--label-on-accent)] text-[13px] focus:outline-none focus:bg-white/20 placeholder-white/50"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (readOnly) return;
                setCaptionDraft(photo.caption);
                setCaptionEditing(true);
              }}
              className="w-full text-left text-[13px] text-white/90 truncate active:opacity-60"
            >
              {photo.caption || (
                <span className="text-white/40">Добавить подпись…</span>
              )}
            </button>
          )}
          <div className="text-[10px] text-white/50 tabular-nums">
            {index + 1} / {photos.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-on-accent)] active:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.data_url}
          alt={photo.caption}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{ WebkitTouchCallout: "none" }}
        />
        {/* Left / right hit zones for desktop click-navigation */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            aria-label="Назад"
            className="absolute top-1/2 left-2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-[var(--label-on-accent)] text-[20px] hidden lg:flex items-center justify-center active:bg-white/20"
          >
            ‹
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            aria-label="Вперёд"
            className="absolute top-1/2 right-2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-[var(--label-on-accent)] text-[20px] hidden lg:flex items-center justify-center active:bg-white/20"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom bar — kind badge + actions */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-3 bg-black/40"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 8px)" }}
      >
        <KindBadge kind={photo.kind} />
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="h-9 px-3 rounded-lg bg-white/10 text-[var(--label-on-accent)] text-[12px] font-semibold active:bg-white/20"
            >
              Пометить…
            </button>
            <button
              type="button"
              onClick={() => onDelete(photo.id)}
              className="ml-auto h-9 px-3 rounded-lg bg-[var(--system-red)] text-[var(--label-on-accent)] text-[12px] font-semibold active:bg-[var(--system-red)]"
            >
              Удалить
            </button>
          </>
        )}
      </div>

      {/* Rekind menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-5"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-[280px] bg-[var(--surface-card)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--separator)] text-[11px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)]">
              Пометить как
            </div>
            {(["before", "after", "other"] as PhotoKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  onRekind(photo.id, k);
                  setMenuOpen(false);
                }}
                disabled={k === photo.kind}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--fill-tertiary)] border-b border-[var(--separator)] last:border-0 disabled:opacity-40"
              >
                <KindBadge kind={k} />
                <span className="text-[14px] font-medium text-[var(--label)]">
                  {kindLabel(k)}
                </span>
                {k === photo.kind && (
                  <span className="ml-auto text-[11px] text-[var(--label-tertiary)]">
                    текущая
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] border-t border-[var(--separator)] active:bg-[var(--fill-tertiary)]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: PhotoKind }) {
  if (kind === "before") {
    return (
      <span className="h-6 px-2 rounded-full bg-[var(--system-red)] text-[var(--label-on-accent)] text-[11px] font-bold flex items-center">
        До
      </span>
    );
  }
  if (kind === "after") {
    return (
      <span className="h-6 px-2 rounded-full bg-[var(--system-green)] text-[var(--label-on-accent)] text-[11px] font-bold flex items-center">
        После
      </span>
    );
  }
  return (
    <span className="h-6 px-2 rounded-full bg-[var(--fill-primary)] text-[var(--label-on-accent)] text-[11px] font-bold flex items-center">
      Прочее
    </span>
  );
}
