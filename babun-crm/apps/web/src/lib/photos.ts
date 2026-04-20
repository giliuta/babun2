// Photo helpers for the AppointmentPhoto flow.
// - compressImage: downscale + jpeg quality cascade until the base64
//   fits the budget (default ~200 KB) so 5 photos × 5 appointments still
//   fit the localStorage quota comfortably.
// - generateCaption: "До · 14:35 · Спальня" built from kind + time +
//   optional object label.
// - validatePhotoSize: quick check for a picked image before asking the
//   user to accept a too-large upload.

import type { PhotoKind } from "./appointments";

const MAX_DIMENSION = 1600;
const DEFAULT_BUDGET_KB = 200;
// base64 is ~1.37x the binary size; keep the budget honest.
const BASE64_OVERHEAD = 1.37;

export async function compressImage(
  file: File,
  budgetKb = DEFAULT_BUDGET_KB
): Promise<string> {
  const img = await fileToImage(file);
  const { width, height } = fit(img.width, img.height, MAX_DIMENSION);

  // Cascade quality levels — stop as soon as we hit the budget.
  const qualities = [0.6, 0.45, 0.3];
  const budgetBytes = budgetKb * 1024 * BASE64_OVERHEAD;

  let lastResult = "";
  for (const q of qualities) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    lastResult = dataUrl;
    if (dataUrl.length < budgetBytes) {
      return dataUrl;
    }
  }
  // None of the passes hit the budget — return the tightest we have.
  return lastResult;
}

export function generateCaption(
  kind: PhotoKind,
  locationLabel?: string,
  date: Date = new Date()
): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const parts: string[] = [kindLabel(kind), `${hh}:${mm}`];
  if (locationLabel && locationLabel.trim()) parts.push(locationLabel.trim());
  return parts.join(" · ");
}

export function kindLabel(kind: PhotoKind): string {
  if (kind === "before") return "До";
  if (kind === "after") return "После";
  return "Прочее";
}

export function validatePhotoSize(dataUrl: string, budgetKb = DEFAULT_BUDGET_KB): boolean {
  return dataUrl.length < budgetKb * 1024 * BASE64_OVERHEAD * 1.1;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось открыть изображение"));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function fit(
  w: number,
  h: number,
  max: number
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}
