import { CircleAlert, CircleCheck } from "lucide-react";

export function Notice({ type, children, error, message }: { type?: "error" | "success" | "info"; children?: React.ReactNode; error?: string; message?: string }) {
  const resolvedType = error ? "error" : message ? "success" : type;
  const content = error ?? message ?? children;
  if (!resolvedType || !content) return null;
  const Icon = resolvedType === "success" ? CircleCheck : CircleAlert;
  return <div className={`notice ${resolvedType}`} role={resolvedType === "error" ? "alert" : "status"}><Icon aria-hidden="true" /><span>{content}</span></div>;
}
