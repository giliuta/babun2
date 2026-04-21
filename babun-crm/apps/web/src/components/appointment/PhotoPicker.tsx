"use client";

import { useRef, useState } from "react";
import type { PhotoKind } from "@/lib/appointments";

interface PhotoPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (kind: PhotoKind, file: File) => void;
}

type Stage = "category" | "source";

// Centered two-step picker: first "what kind of photo", then
// "camera vs gallery". Splitting the two steps avoids the iOS PWA
// pitfall where `capture="environment"` silently falls back to the
// gallery picker after the input has been idle 30 seconds.
export default function PhotoPicker({ open, onClose, onPick }: PhotoPickerProps) {
  const [stage, setStage] = useState<Stage>("category");
  const [kind, setKind] = useState<PhotoKind>("before");
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setStage("category");
    setKind("before");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickKind = (k: PhotoKind) => {
    setKind(k);
    setStage("source");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so the same file can be picked again later.
    e.target.value = "";
    if (!file) return;
    onPick(kind, file);
    reset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-5"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 text-center text-[15px] font-semibold text-[var(--label)]">
          {stage === "category" ? "Что это за фото?" : "Откуда снимок?"}
        </div>

        {stage === "category" && (
          <div className="p-3 space-y-2">
            <CategoryButton
              title="До"
              subtitle="Состояние до работы"
              color="rose"
              onClick={() => pickKind("before")}
            />
            <CategoryButton
              title="После"
              subtitle="Готово, клиент принял"
              color="emerald"
              onClick={() => pickKind("after")}
            />
            <CategoryButton
              title="Прочее"
              subtitle="Пломба, табличка, счёт"
              color="slate"
              onClick={() => pickKind("other")}
            />
          </div>
        )}

        {stage === "source" && (
          <div className="p-3 space-y-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white text-[14px] font-semibold active:scale-[0.99] flex items-center justify-center gap-2"
            >
              📸 Камера
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="w-full h-12 rounded-xl bg-white border border-[var(--separator)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)] flex items-center justify-center gap-2"
            >
              🖼 Из галереи
            </button>
            <button
              type="button"
              onClick={() => setStage("category")}
              className="w-full h-10 text-[13px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)] rounded-xl"
            >
              ← Назад
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleClose}
          className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] border-t border-[var(--separator)] active:bg-[var(--fill-tertiary)]"
        >
          Отмена
        </button>

        {/* Hidden file inputs — camera first, gallery fallback. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}

function CategoryButton({
  title,
  subtitle,
  color,
  onClick,
}: {
  title: string;
  subtitle: string;
  color: "rose" | "emerald" | "slate";
  onClick: () => void;
}) {
  const styles: Record<typeof color, string> = {
    rose: "bg-[rgba(255,59,48,0.08)] border-[rgba(255,59,48,0.25)] text-[var(--system-red)] active:bg-[rgba(255,59,48,0.14)]",
    emerald:
      "bg-[rgba(52,199,89,0.08)] border-[rgba(52,199,89,0.25)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.14)]",
    slate: "bg-white border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-tertiary)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-14 px-3 rounded-xl border text-left flex flex-col justify-center ${styles[color]}`}
    >
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="text-[11px] opacity-75">{subtitle}</div>
    </button>
  );
}
