// STORY-079 — Same-origin guard for state-mutating API routes.
//
// Cookie-based session auth alone is not enough on POST endpoints
// that mutate user state. A page on evil.com can `<form method="POST"
// action="https://babun.app/api/account/delete">` and the user's
// browser sends our session cookie. SameSite=Lax helps but isn't
// universal across legacy browsers and doesn't cover all top-level
// navigation patterns.
//
// Cheap, reliable defence: require the request to come from a same-
// origin context. Browsers send `Sec-Fetch-Site: same-origin` on
// fetches initiated from the same origin; cross-site requests get
// `same-site` / `cross-site` / `none`. Older browsers without that
// header fall back to an `Origin` allowlist check.

const PROD_ORIGINS = ["https://babun.app", "https://www.babun.app"];
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  // Vercel preview deploys: <branch>-<hash>-<scope>.vercel.app
  if (origin.startsWith("https://") && origin.endsWith(".vercel.app")) return true;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && DEV_ORIGINS.includes(origin)) return true;
  return false;
}

/** Returns true when the request can be served safely; false when it
 *  looks like a cross-site CSRF. Caller should respond 403. */
export function isSameOriginRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;

  // Browsers that don't send Sec-Fetch-Site (older Safari, mostly):
  // fall back to Origin / Referer.
  if (fetchSite === null) {
    const origin = req.headers.get("origin");
    if (origin && isAllowedOrigin(origin)) return true;
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (isAllowedOrigin(refOrigin)) return true;
      } catch {
        /* malformed referer */
      }
    }
    // No headers at all → likely curl / server-to-server. Allow on
    // dev (so testing doesn't choke), reject on prod.
    if (process.env.NODE_ENV !== "production") return true;
    return false;
  }

  // sec-fetch-site is `cross-site` or `none` → reject.
  return false;
}
