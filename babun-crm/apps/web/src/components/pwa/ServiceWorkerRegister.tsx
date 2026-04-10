"use client";

import { useEffect } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000; // check for new SW every 60s

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let reloading = false;

    // When the controller (active SW) changes, the new SW has taken over.
    // Reload once so the page is served by the new version.
    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Tell a waiting SW to activate immediately
    const promoteWaiting = (waiting: ServiceWorker) => {
      waiting.postMessage({ type: "SKIP_WAITING" });
    };

    // Watch a registration for an installing SW becoming installed (waiting)
    const trackInstalling = (sw: ServiceWorker) => {
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          // A new SW is waiting and we already have an active controller — promote it
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

        // If a waiting worker exists at registration time, promote it now
        if (registration.waiting && navigator.serviceWorker.controller) {
          promoteWaiting(registration.waiting);
        }

        // Track installing worker (first install or update)
        if (registration.installing) {
          trackInstalling(registration.installing);
        }
        registration.addEventListener("updatefound", () => {
          if (registration?.installing) trackInstalling(registration.installing);
        });

        // Periodically check for updates
        interval = setInterval(() => {
          registration?.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);

        // Also check when the tab becomes visible again
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
