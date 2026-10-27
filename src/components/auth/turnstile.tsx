"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

export function Turnstile({ action, resetKey }: { action: "login" | "password_reset"; resetKey?: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [error, setError] = useState("");
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const render = useCallback(() => {
    if (!sitekey || !container.current || !window.turnstile || widget.current !== undefined) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey, action, theme: "light", size: "flexible",
      callback: () => setError(""),
      "error-callback": () => setError("Security check could not load. Check your connection and retry."),
      "expired-callback": () => setError("Security check expired. Please verify again."),
    });
  }, [action, sitekey]);
  useEffect(() => {
    render();
    return () => { if (widget.current !== undefined) window.turnstile?.remove(widget.current); widget.current = undefined; };
  }, [render]);
  useEffect(() => { if (widget.current !== undefined) window.turnstile?.reset(widget.current); }, [resetKey]);
  return <div className="turnstile-check">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} onError={() => setError("Security check could not load. Check your connection and retry.")} />
    <div ref={container} />
    {!sitekey && <p role="alert">Sign-in security is temporarily unavailable. Contact the tool custodian.</p>}
    {error && <><p role="alert">{error}</p><button type="button" className="text-link" onClick={() => { if (widget.current !== undefined) window.turnstile?.reset(widget.current); else render(); setError(""); }}>Retry security check</button></>}
    <noscript>Enable JavaScript to complete the security check.</noscript>
  </div>;
}
