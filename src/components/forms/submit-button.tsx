"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Working…", className = "button button-primary" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} type="submit">{pending ? pendingText : children}</button>;
}
