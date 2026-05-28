// Client-side image compressor for receipt photos.
// Keeps the long edge ≤ 1080 px and re-encodes as JPEG at 0.8 quality.
// Returns the original blob unchanged if it's not an image, or if the
// canvas conversion fails for any reason (we'd rather upload a larger
// file than fail the user's save).

const MAX_LONG_EDGE = 1080;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, MAX_LONG_EDGE / Math.max(img.width, img.height));
      if (scale >= 1 && file.size < 800_000) return file;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, w, h);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY),
      );
      return blob ?? file;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
