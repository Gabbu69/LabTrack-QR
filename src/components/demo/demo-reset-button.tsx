"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function DemoResetButton() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false); const router = useRouter();
  async function reset() { if (pending.current) return; if (!window.confirm("Restore the fictional demo accounts, tools, and transactions? Operational records are never touched.")) return; pending.current = true; setBusy(true); try { const response = await fetch("/api/demo/reset", { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); router.push("/dashboard"); router.refresh(); } catch (error) { window.alert(error instanceof Error ? error.message : "Demo reset failed."); } finally { pending.current = false; setBusy(false); } }
  return <button className="demo-reset" type="button" onClick={reset} disabled={busy}><RefreshCw aria-hidden="true" />{busy ? "Resetting…" : "Reset demo"}</button>;
}
