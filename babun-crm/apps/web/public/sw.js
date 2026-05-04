// Babun CRM Service Worker
// Increment CACHE_VERSION on every deploy to invalidate caches
const CACHE_VERSION = "babun-v378";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/chats",
  "/dashboard/finances",
  "/dashboard/services",
  "/dashboard/sms-templates",
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

  // Network-first for HTML pages
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/dashboard")))
    );
  }
});

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
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
