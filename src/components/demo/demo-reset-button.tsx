"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function DemoResetButton() {
  const [busy, setBusy] = useState(false); const router = useRouter();
  async function reset() { if (!window.confirm("Restore the fictional demo accounts, tools, and transactions? Operational records are never touched.")) return; setBusy(true); try { const response = await fetch("/api/demo/reset", { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); router.push("/dashboard"); router.refresh(); } catch (error) { window.alert(error instanceof Error ? error.message : "Demo reset failed."); setBusy(false); } }
  return <button className="demo-reset" type="button" onClick={reset} disabled={busy}><RefreshCw aria-hidden="true" />{busy ? "Resetting…" : "Reset demo"}</button>;
}
