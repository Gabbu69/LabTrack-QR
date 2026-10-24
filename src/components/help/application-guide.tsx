"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";
import { describePage } from "@/lib/control-help";
import { pageMission } from "@/lib/guide-missions";

export function ApplicationGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  return <div className="account-help">
    <button type="button" className="account-help-trigger" aria-label="Help and user guide" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><CircleHelp aria-hidden="true" /></button>
    <dialog ref={dialog} className="account-help-dialog" aria-labelledby="account-help-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header><h2 id="account-help-title">Help & user guide</h2><button type="button" aria-label="Close help" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button></header>
      <p>{describePage(pathname)}</p>
      <ol>{pageMission(pathname).map(step => <li key={step}>{step}</li>)}</ol>
      <Link className="button button-secondary" href="/guide" onClick={() => dialog.current?.close()}>Open user guide</Link>
    </dialog>
  </div>;
}
