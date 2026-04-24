"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Camera, Trash2, X } from "lucide-react";
import { getAvatarPresets, isAvatarSet } from "@/lib/avatars";
import { haptic } from "@/lib/haptics";

interface AvatarPickerSheetProps {
  open: boolean;
  value: string | null | undefined;
  onSelect: (next: string | null) => void;
  onClose: () => void;
}

const MAX_UPLOAD_BYTES = 1_200_000; // ~1.2 MB after base64

export default function AvatarPickerSheet({
  open,
  value,
  onSelect,
  onClose,
}: AvatarPickerSheetProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const presets = getAvatarPresets();

  const pick = (next: string | null) => {
    haptic("tap");
    onSelect(next);
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Слишком большой файл — до 1 МБ");
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      pick(dataUrl);
    } catch {
      setError("Не удалось прочитать файл");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
            Фото сотрудника
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
            Выбрать аватар
          </div>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((src) => {
              const active = value === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => pick(src)}
                  className={`relative aspect-square rounded-[14px] overflow-hidden bg-[var(--fill-tertiary)] active:scale-[0.97] transition ${
                    active ? "ring-2 ring-[var(--accent)]" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {active && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shadow">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[12px] bg-[var(--fill-tertiary)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--fill-secondary)]"
            >
              <Camera size={16} strokeWidth={2} />
              Загрузить своё фото
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            {isAvatarSet(value) && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-[12px] bg-[var(--fill-tertiary)] text-[var(--system-red)] text-[14px] font-medium active:bg-[rgba(255,59,48,0.08)]"
              >
                <Trash2 size={15} strokeWidth={2} />
                Убрать фото
              </button>
            )}
            {error && (
              <div className="text-[12px] text-[var(--system-red)] text-center">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
