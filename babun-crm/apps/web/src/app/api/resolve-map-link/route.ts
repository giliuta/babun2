import { NextResponse } from "next/server";

// Resolves a possibly-shortened map link to coordinates.
//
// Google Maps, Waze and Apple Maps all support short URLs (goo.gl,
// maps.app.goo.gl, waze.com/ul/xxx, etc.) that 301 to a full URL which
// contains the actual coordinates. Client-side fetch can't follow the
// redirect because of CORS, so we do it here on the server and return
// just the parsed lat/lng.

export const runtime = "nodejs";

interface ResolveResponse {
  resolved_url: string | null;
  coords: { lat: number; lng: number } | null;
}

// Extracts lat/lng from either a URL or arbitrary HTML. Tries the most
// specific patterns first, falls back to a generic "-?DD.DDDD,-?DD.DDDD"
// search.
function extractCoords(
  text: string
): { lat: number; lng: number } | null {
  const valid = (lat: number, lng: number) =>
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  // Google Maps: /@LAT,LNG,ZOOMz
  const atMatch = text.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+),\d+/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ll=LAT,LNG (Apple, Waze, some Google links)
  const llMatch = text.match(/[?&#]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // latlng=LAT,LNG (Waze)
  const latlngMatch = text.match(/[?&#]latlng=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (latlngMatch) {
    const lat = parseFloat(latlngMatch[1]);
    const lng = parseFloat(latlngMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // q=LAT,LNG (Google, Apple)
  const qMatch = text.match(/[?&#]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // Generic LAT,LNG anywhere in the string (with at least 3 decimals)
  const match = text.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  return null;
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

  // Only follow http(s) URLs to avoid local file or intranet lookups.
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json<ResolveResponse>({
      resolved_url: null,
      coords: extractCoords(target),
    });
  }

  try {
    const res = await fetch(target, {
      redirect: "follow",
      headers: {
        // A real-looking UA helps Google Maps return the mobile page
        // which uses the /@LAT,LNG,ZOOM pattern.
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const finalUrl = res.url;
    // Try the final URL first — fast and reliable for most services.
    let coords = extractCoords(finalUrl);

    // Fall back to HTML scrape if the URL itself doesn't expose coords.
    if (!coords) {
      const html = await res.text();
      coords = extractCoords(html);
    }

    return NextResponse.json<ResolveResponse>({
      resolved_url: finalUrl,
      coords,
    });
  } catch (err) {
    return NextResponse.json<ResolveResponse>(
      {
        resolved_url: null,
        coords: null,
      },
      { status: 200 } // don't break the UI on fetch errors
    );
  }
}
