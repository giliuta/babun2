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

// Build a deep link URL for the given service. Works for both plain
// addresses and URLs with embedded coordinates. Short URLs that we
// cannot parse fall back to opening the raw URL directly when the
// requested service is Google; Apple and Waze fall back to text
// search, which is a best-effort.
export function buildMapUrl(
  service: MapService,
  input: string
): string | null {
  if (!input) return null;
  const parsed = parseAddress(input);

  if (parsed.coords) {
    const { lat, lng } = parsed.coords;
    if (service === "google") {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (service === "apple") {
      return `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`;
    }
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  // No coordinates — if it's a URL the Google button just opens the
  // link as-is (the Google apps resolve short URLs themselves). Apple
  // and Waze fall back to a text query, which works for regular
  // addresses and degrades gracefully for short URLs.
  if (parsed.isUrl && service === "google") {
    return parsed.raw.startsWith("http") ? parsed.raw : `https://${parsed.raw}`;
  }

  const q = encode(parsed.raw);
  if (service === "google") {
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  if (service === "apple") {
    return `https://maps.apple.com/?q=${q}`;
  }
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}
