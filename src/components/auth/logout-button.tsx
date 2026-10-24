"use client";

import { useId, useRef } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";

export function LogoutButton({ className = "portal-nav-link portal-logout", label = "Log Out" }: { className?: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <>
    <button className={className} type="button" onClick={() => dialog.current?.showModal()}><LogOut aria-hidden="true" /><span>{label}</span></button>
    <dialog ref={dialog} className="logout-dialog" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <h2 id={titleId}>Are you sure you want to log out?</h2>
      <p>You can sign in again anytime.</p>
      <div className="logout-dialog-actions"><button type="button" className="button button-secondary" onClick={() => dialog.current?.close()}>Stay signed in</button><form action={signOutAction}><SubmitButton pendingText="Signing out…">Yes, log out</SubmitButton></form></div>
    </dialog>
  </>;
}
