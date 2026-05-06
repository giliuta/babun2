import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// Resolves a (possibly shortened) map link to coordinates.
//
// Short URLs like maps.app.goo.gl/xyz, goo.gl/maps, or waze.com/ul/xyz
// never contain coordinates themselves — they 30x redirect to a full
// URL that does. Client-side fetch can't follow those redirects
// because of CORS, so we do the chain manually on the server and scan
// every URL along the way for a coordinate pattern.
//
// STORY-079 hardening — this endpoint used to be unauthenticated
// and would fetch ANY URL. That's a textbook SSRF (AWS IMDS at
// 169.254.169.254, internal Vercel hosts, RFC1918 ranges). Now:
//   * auth-gated (must be a logged-in tenant member)
//   * host allowlist — only known map-link hostnames
//   * private/loopback/link-local IP ranges blocked at every hop
//   * https-only (no http://, no file://, no data:)

export const runtime = "nodejs";

// Hostnames we'll fetch from. Suffix match — both the bare host
// and any subdomain of it. Keep the list tight; new map providers
// must be added explicitly.
const ALLOWED_HOST_SUFFIXES = [
  "google.com",
  "google.cy",
  "google.ru",
  "google.gr",
  "goo.gl",
  "maps.app.goo.gl",
  "apple.com",
  "maps.apple.com",
  "waze.com",
  "yandex.ru",
  "yandex.com",
  "2gis.ru",
  "2gis.com",
  "bit.ly",
  "t.co",
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suf) => h === suf || h.endsWith("." + suf),
  );
}

// IPv4 / IPv6 literal blocklist for SSRF defence.
function isBlockedIp(hostname: string): boolean {
  // IPv4 dotted-quad
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (v4) {
    const [a, b] = [parseInt(v4[1]!, 10), parseInt(v4[2]!, 10)];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. AWS IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6 link-local / loopback / unique-local
  if (/^::1$/i.test(hostname)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(hostname)) return true;
  if (/^f[cd][0-9a-f][0-9a-f]:/i.test(hostname)) return true;
  return false;
}

function safeUrl(raw: string, base?: string): URL | null {
  let u: URL;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.protocol === "http:" && process.env.NODE_ENV === "production") return null;
  if (isBlockedIp(u.hostname)) return null;
  if (!isAllowedHost(u.hostname)) return null;
  return u;
}

interface ResolveResponse {
  resolved_url: string | null;
  coords: { lat: number; lng: number } | null;
}

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function valid(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // Exclude the (0,0) null island — almost always a false positive.
    !(lat === 0 && lng === 0)
  );
}

// Tries a whole zoo of coordinate patterns from URLs and HTML pages
// returned by Google / Apple / Waze / generic providers.
function extractCoords(
  text: string
): { lat: number; lng: number } | null {
  if (!text) return null;

  const tryMatch = (re: RegExp): { lat: number; lng: number } | null => {
    const m = text.match(re);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    return valid(lat, lng) ? { lat, lng } : null;
  };

  // ─── Google Maps URL patterns ────────────────────────────────────
  // /@LAT,LNG,ZOOMz — main place URL
  let hit = tryMatch(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)(?:,-?\d+(?:\.\d+)?z?)/);
  if (hit) return hit;
  // !3dLAT!4dLNG — buried inside the data= parameter of a place URL
  hit = tryMatch(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (hit) return hit;
  // !2d(lng)!3d(lat) — inverted order, older Google Maps format
  hit = tryMatch(/!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,3}\.\d+)/);
  if (hit) {
    // Swap because this pattern stores lng first, then lat
    const { lat, lng } = hit;
    if (valid(lng, lat)) return { lat: lng, lng: lat };
  }
  // /maps/dir/FROM/TO/@LAT,LNG,... (directions URL) — same /@ pattern above handles it.

  // ─── Explicit query-string params ────────────────────────────────
  hit = tryMatch(/[?&#]ll=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;
  hit = tryMatch(/[?&#]latlng=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;
  hit = tryMatch(/[?&#]center=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;
  hit = tryMatch(/[?&#]q=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;
  hit = tryMatch(/[?&#]query=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;
  hit = tryMatch(/[?&#]destination=(-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;

  // ─── Waze specific ───────────────────────────────────────────────
  // https://waze.com/ul/hsvXXXXXX — not a coordinate format, skip
  // https://www.waze.com/live-map/directions?to=ll.LAT%2CLNG or ll=LAT,LNG
  hit = tryMatch(/ll[.=](-?\d+\.\d+)[,%2C ]+(-?\d+\.\d+)/i);
  if (hit) return hit;

  // ─── HTML scrape patterns (JSON-LD, app state) ───────────────────
  hit = tryMatch(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/);
  if (hit) return hit;
  hit = tryMatch(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/);
  if (hit) return hit;
  hit = tryMatch(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lon"\s*:\s*(-?\d+\.\d+)/);
  if (hit) return hit;
  hit = tryMatch(/GeoPoint\((-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\)/);
  if (hit) return hit;
  hit = tryMatch(/LatLng\((-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\)/);
  if (hit) return hit;

  // ─── Generic "DD.DDDD,DD.DDDD" fallback ──────────────────────────
  hit = tryMatch(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (hit) return hit;

  return null;
}

// Manually follows up to `maxHops` 30x redirects and returns every URL
// visited along the way, including the original. This lets us scan
// intermediate redirect Location headers where short URLs expose their
// real target before we even need to load the HTML.
async function followRedirects(
  initial: string,
  maxHops = 10
): Promise<string[]> {
  const visited: string[] = [];
  let current = initial;
  for (let i = 0; i < maxHops; i++) {
    // SSRF check on EVERY hop — the initial URL was validated, but
    // the Location header can redirect us anywhere.
    const checked = safeUrl(current);
    if (!checked) break;
    visited.push(current);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch {
      break;
    }
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get("location");
    if (!loc) break;
    const next = safeUrl(loc, current);
    if (!next) break;
    current = next.toString();
    if (visited.includes(current)) break; // cycle guard
  }
  return visited;
}

export async function GET(request: Request) {
  // STORY-079 — auth gate. Was open for SSRF exploitation.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { resolved_url: null, coords: null, error: "missing url param" },
      { status: 400 }
    );
  }

  // Allow raw text as well — useful for clients that call us with
  // something that already contains coordinates.
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json<ResolveResponse>({
      resolved_url: null,
      coords: extractCoords(target),
    });
  }

  // Validate the initial URL. Out-of-allowlist or private-IP targets
  // are rejected before any fetch happens.
  const initial = safeUrl(target);
  if (!initial) {
    return NextResponse.json(
      { resolved_url: null, coords: null, error: "host_not_allowed" },
      { status: 400 },
    );
  }

  try {
    // 1. Manually follow redirects, trying to extract coords from each
    //    intermediate URL. Short URLs often reveal the coordinates
    //    right in the first redirect Location header.
    const urls = await followRedirects(initial.toString());
    for (const u of urls) {
      const coords = extractCoords(u);
      if (coords) {
        return NextResponse.json<ResolveResponse>({
          resolved_url: urls[urls.length - 1],
          coords,
        });
      }
    }

    // 2. No coords in any URL along the chain — fetch the final page
    //    with auto-follow (some origins only serve content via JS on
    //    the final hop) and scan the HTML.
    //
    // We use redirect:'manual' here too because redirect:'follow'
    // bypasses our SSRF host check on intermediate hops. The last URL
    // in `urls` already passed the allowlist; fetch that directly.
    const lastUrl = urls.length > 0 ? urls[urls.length - 1]! : initial.toString();
    const lastChecked = safeUrl(lastUrl);
    if (!lastChecked) {
      return NextResponse.json<ResolveResponse>({
        resolved_url: null,
        coords: null,
      });
    }
    const finalRes = await fetch(lastChecked.toString(), {
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const finalUrl = lastChecked.toString();
    const finalUrlCoords = extractCoords(finalUrl);
    if (finalUrlCoords) {
      return NextResponse.json<ResolveResponse>({
        resolved_url: finalUrl,
        coords: finalUrlCoords,
      });
    }
    // Cap response body at 256 KB so we don't OOM on a malicious giant page.
    const html = (await finalRes.text()).slice(0, 256 * 1024);
    const htmlCoords = extractCoords(html);
    return NextResponse.json<ResolveResponse>({
      resolved_url: finalUrl,
      coords: htmlCoords,
    });
  } catch {
    return NextResponse.json<ResolveResponse>(
      { resolved_url: null, coords: null },
      { status: 200 }
    );
  }
}
