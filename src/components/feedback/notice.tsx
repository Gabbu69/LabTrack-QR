"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

export function Notice({ type, children, error, message, dismissible = false }: { type?: "error" | "success" | "info"; children?: React.ReactNode; error?: string; message?: string; dismissible?: boolean }) {
  const resolvedType = error ? "error" : message ? "success" : type;
  const content = error ?? message ?? children;
  if (!resolvedType || !content) return null;
  if (!dismissible) {
    const Icon = resolvedType === "success" ? CircleCheck : CircleAlert;
    return <div className={`notice ${resolvedType}`} role={resolvedType === "error" ? "alert" : "status"}><Icon aria-hidden="true" /><span>{content}</span></div>;
  }
  return <DismissibleNotice key={`${resolvedType}:${error ?? message ?? "content"}`} type={resolvedType} clearQuery={Boolean(error || message)}>{content}</DismissibleNotice>;
}

function DismissibleNotice({ type, clearQuery, children }: { type: "error" | "success" | "info"; clearQuery: boolean; children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const Icon = type === "success" ? CircleCheck : CircleAlert;
  function dismiss() {
    setDismissed(true);
    if (clearQuery) {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      url.searchParams.delete("message");
      // Only the notification URL changes; the records do not need another read.
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }
  return <div className={`notice ${type}`} role={type === "error" ? "alert" : "status"}><Icon aria-hidden="true" /><span>{children}</span><button type="button" className="notice-close" aria-label="Dismiss notification" onClick={dismiss}><X aria-hidden="true" /></button></div>;
}
