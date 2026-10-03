"use client";

import { useEffect } from "react";

export function SessionExpiry() {
  useEffect(() => {
    let checking = false;
    const controller = new AbortController();
    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/session", { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          window.location.replace("/login?message=Your+session+ended.+Please+sign+in+again.");
        }
      } catch { /* A network failure is not evidence that the session expired. */ }
      finally { checking = false; }
    }
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  return null;
}
