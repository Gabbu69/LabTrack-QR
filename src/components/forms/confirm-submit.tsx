"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ConfirmSubmit({ children, message, className }: { children: ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{pending ? "Saving…" : children}</button>;
}
