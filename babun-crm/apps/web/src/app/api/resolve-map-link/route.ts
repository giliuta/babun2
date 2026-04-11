import { NextResponse } from "next/server";

// Resolves a (possibly shortened) map link to coordinates.
//
// Short URLs like maps.app.goo.gl/xyz, goo.gl/maps, or waze.com/ul/xyz
// never contain coordinates themselves — they 30x redirect to a full
// URL that does. Client-side fetch can't follow those redirects
// because of CORS, so we do the chain manually on the server and scan
// every URL along the way for a coordinate pattern.

export const runtime = "nodejs";

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
    try {
      current = new URL(loc, current).toString();
    } catch {
      break;
    }
    if (visited.includes(current)) break; // cycle guard
  }
  return visited;
}

export async function GET(request: Request) {
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

  try {
    // 1. Manually follow redirects, trying to extract coords from each
    //    intermediate URL. Short URLs often reveal the coordinates
    //    right in the first redirect Location header.
    const urls = await followRedirects(target);
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
    const finalRes = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const finalUrl = finalRes.url;
    const finalUrlCoords = extractCoords(finalUrl);
    if (finalUrlCoords) {
      return NextResponse.json<ResolveResponse>({
        resolved_url: finalUrl,
        coords: finalUrlCoords,
      });
    }
    const html = await finalRes.text();
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
