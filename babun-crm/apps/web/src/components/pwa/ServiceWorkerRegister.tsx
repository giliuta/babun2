"use client";

import { useEffect } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

// In dev we completely unregister any existing SW and wipe caches so you
// always see the freshest code. SW only runs in production.
const IS_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    /^192\.168\./.test(window.location.hostname) ||
    /^10\./.test(window.location.hostname));

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // ── DEV MODE: kill any SW + nuke all caches, never register ──────
    if (IS_DEV) {
      (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          // If a SW was actually unregistered, reload once to get fresh HTML
          if (regs.length > 0) window.location.reload();
        } catch {
          // ignore
        }
      })();
      return;
    }

    // ── PROD MODE: normal registration with fast updates ────────────
    let registration: ServiceWorkerRegistration | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let reloading = false;

    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const promoteWaiting = (waiting: ServiceWorker) => {
      waiting.postMessage({ type: "SKIP_WAITING" });
    };

    const trackInstalling = (sw: ServiceWorker) => {
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          promoteWaiting(sw);
        }
      });
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          promoteWaiting(registration.waiting);
        }

        if (registration.installing) trackInstalling(registration.installing);
        registration.addEventListener("updatefound", () => {
          if (registration?.installing) trackInstalling(registration.installing);
        });

        interval = setInterval(() => {
          registration?.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);

        const onVisibility = () => {
          if (document.visibilityState === "visible") {
            registration?.update().catch(() => {});
          }
        };
        document.addEventListener("visibilitychange", onVisibility);
      } catch (err) {
        console.warn("SW registration failed", err);
      }
    };

    register();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
