// Map link helpers for the appointment address field.
//
// Users can type a plain address OR paste a link from any navigation
// service (Google Maps, Waze, Apple Maps, including the short forms
// like goo.gl/maps and maps.app.goo.gl). The address field keeps the
// raw input; the three "open in" buttons route that input through the
// appropriate deep link.

export type MapService = "google" | "apple" | "waze";

export interface ParsedAddress {
  raw: string;
  coords: { lat: number; lng: number } | null;
  isUrl: boolean;
}

// Pulls the first "lat,lng" pair out of arbitrary text. Demands at
// least three decimal digits on both sides to avoid matching things
// like prices or times.
export function extractCoords(
  input: string
): { lat: number; lng: number } | null {
  const match = input.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function isLikelyUrl(input: string): boolean {
  const trimmed = input.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?(maps\.google|google\.com\/maps|goo\.gl|maps\.app\.goo\.gl|waze\.com|maps\.apple)/i.test(
      trimmed
    )
  );
}

export function parseAddress(input: string): ParsedAddress {
  const raw = input.trim();
  return {
    raw,
    coords: extractCoords(raw),
    isUrl: isLikelyUrl(raw),
  };
}

function encode(input: string): string {
  return encodeURIComponent(input);
}

// Build a deep link URL for the given service. If `overrideCoords` is
// supplied (e.g. resolved via the /api/resolve-map-link endpoint) it
// takes precedence over whatever could be parsed from the input text.
export function buildMapUrl(
  service: MapService,
  input: string,
  overrideCoords?: { lat: number; lng: number } | null
): string | null {
  if (!input && !overrideCoords) return null;
  const parsed = input ? parseAddress(input) : null;
  const coords = overrideCoords ?? parsed?.coords ?? null;

  if (coords) {
    const { lat, lng } = coords;
    if (service === "google") {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (service === "apple") {
      return `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`;
    }
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  // No coordinates — if it's a URL the Google button opens the link
  // as-is (Google's apps resolve short URLs themselves). Apple and
  // Waze fall back to a text query.
  if (parsed?.isUrl && service === "google") {
    return parsed.raw.startsWith("http") ? parsed.raw : `https://${parsed.raw}`;
  }

  const q = encode(parsed?.raw ?? "");
  if (service === "google") {
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  if (service === "apple") {
    return `https://maps.apple.com/?q=${q}`;
  }
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}

// Client-side helper that calls our /api/resolve-map-link endpoint to
// follow short URLs and extract coordinates server-side.
export async function resolveMapLink(
  url: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `/api/resolve-map-link?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      coords: { lat: number; lng: number } | null;
    };
    return data.coords;
  } catch {
    return null;
  }
}
