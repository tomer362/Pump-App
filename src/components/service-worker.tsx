"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes the app installable and
 * lets it receive push. Registration is deferred until after load so it never
 * competes with the first paint.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Registration failing must never break the app. */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
