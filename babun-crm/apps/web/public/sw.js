// Babun CRM Service Worker
// Increment CACHE_VERSION on every deploy to invalidate caches
const CACHE_VERSION = "babun-v424";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Precache the main shells so first visits to each section after
// install paint instantly from cache (stale-while-revalidate). When a
// new section is added under /dashboard, list it here so users don't
// pay the network cold-start on first navigation.
const PRECACHE_URLS = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/chats",
  "/dashboard/finances",
  "/dashboard/services",
  "/dashboard/sms-templates",
  "/dashboard/teams",
  "/dashboard/masters",
  "/dashboard/inventory",
  "/dashboard/recurring",
  "/dashboard/analytics",
  "/dashboard/income",
  "/dashboard/close-day",
  "/dashboard/settings",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
];

// Install: precache core pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML/API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip Supabase and Vercel internals
  const url = new URL(request.url);
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/_next/data") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Cache-first for static assets + DiceBear avatar SVGs (used for
  // master profile presets; URL has no file extension so we match
  // by hostname).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|gif|woff2?|css|js|ico)$/) ||
    url.hostname === "api.dicebear.com"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for HTML pages.
  //
  // OLD network-first: every navigation blocked on a network round-trip
  // to Vercel before showing anything. On flaky LTE / wifi the page
  // would just hang for tens of seconds, which the user read as "the
  // page didn't open." Worse, network-first with no timeout means even
  // when we DO have a cached copy, we wait for the network first —
  // defeating the point of having a cache.
  //
  // NEW: serve cached HTML INSTANTLY (next paint), kick off a background
  // fetch to refresh the cache for next time. Plus a 3-second network
  // timeout — if the network hasn't returned anything AND we have no
  // cache, fall back to the /dashboard shell so the user at least sees
  // the app frame instead of a blank tab.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(handleNavigate(request));
  }
});

async function handleNavigate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  // Background refresh — never awaited from the main flow. The next
  // visit to this URL gets the fresh copy from cache.
  const networkUpdate = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // If we have a cached copy, return it immediately. The page paints
  // while the background fetch quietly refreshes the cache.
  if (cached) return cached;

  // No cache — race the network against a 3s deadline. If the network
  // wins we return its response. If the deadline wins, fall back to
  // the precache shell so the user sees the app frame.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
  const winner = await Promise.race([networkUpdate, timeout]);
  if (winner) return winner;

  const fallback =
    (await caches.match("/dashboard")) ||
    (await caches.match("/")) ||
    new Response("Babun загружается… проверьте подключение.", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  return fallback;
}

// Push notification (for future use)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(data.title || "Babun CRM", {
          body: data.body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          data: data.url ? { url: data.url } : undefined,
        }),
        // STORY-054 G5 — wake every open client to drain the queue.
        // See the `sync` event handler comment for why this lives in
        // the client and not the SW. Best-effort: if no clients are
        // open (push received with the app fully closed) the queue
        // drains the next time the user opens the app via the normal
        // online-event path.
        self.clients.matchAll({ includeUncontrolled: true }).then((all) => {
          for (const client of all) {
            client.postMessage({
              type: "BABUN_SYNC_REPLAY",
              source: "push-event",
            });
          }
        }),
      ]),
    );
  } catch (e) {
    // ignore malformed payload
  }
});

// Allow client to trigger immediate activation of a waiting SW
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// STORY-054 G5 — Background Sync nudge.
//
// We don't drain the queue from the SW directly: the queue lives in
// IndexedDB and is mutated by typed wrappers (lib/sync/*) that
// import the `idb` library and our shared Database types — none of
// which exist in this raw SW context. Duplicating the dispatch
// logic in plain JS would invite drift between SW + client paths.
//
// Instead, this listener is a *nudge*: it broadcasts a message to
// every open client of the origin so their in-page replayer (which
// has the typed cache module loaded) wakes up and drains. Clients
// listen for { type: "BABUN_SYNC_REPLAY" } in the dashboard layout
// and call kickReplayer().
//
// Platform note: the `sync` event is Chromium-only (Chrome / Edge /
// Android PWA). iOS Safari and iOS PWA do not implement Background
// Sync API at all, so on iPhone this listener is dead code — the
// in-page `online` event listener (lib/sync/network.ts) is what
// actually kicks the drain there. That's intentional and acceptable:
// the iOS PWA can't truly run in the background anyway. Whenever
// Apple flips the bit, this code starts working with no changes.
self.addEventListener("sync", (event) => {
  if (event.tag !== "babun-sync-queue") return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        client.postMessage({ type: "BABUN_SYNC_REPLAY", source: "sync-event" });
      }
    }),
  );
});

// Same nudge piggy-backed on push events (STORY-053b): a push
// arriving usually means the server has fresh data + we're online,
// so it's a free signal to flush any local writes the user queued
// while the tab was backgrounded. iOS PWA receives push events even
// when fully closed, so this is the closest thing we have to
// background-sync-on-iOS.

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // STORY-080 — only allow same-origin paths. Reject absolute URLs,
  // protocol-relative `//attacker.com`, and any non-/-prefixed value.
  // Keeps phishing-via-push from being a thing if the push payload
  // ever gets shaped by an untrusted source in future.
  const raw = event.notification.data?.url;
  const url = typeof raw === "string" && /^\/[^/]/.test(raw) ? raw : "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
