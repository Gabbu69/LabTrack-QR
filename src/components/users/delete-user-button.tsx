"use client";

import { useId, useRef } from "react";
import { deleteUserAction } from "@/app/actions/operations";
import { SubmitButton } from "@/components/forms/submit-button";

export function DeleteUserButton({ id, name, email }: { id: string; name: string; email: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return <>
    <button type="button" className="button button-small button-danger" aria-label={`Delete ${name}`} onClick={() => dialog.current?.showModal()}>Delete</button>
    <dialog ref={dialog} className="logout-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>Delete this user?</h2>
      <p><strong>{name}</strong><br />{email}</p>
      <p id={descriptionId}>This permanently removes their sign-in account and profile photo. It cannot be undone. Accounts linked to tools or borrowing and return records must be disabled instead.</p>
      <form action={deleteUserAction}>
        <input type="hidden" name="profile_id" value={id} />
        <input type="hidden" name="confirmation_email" value={email} />
        <div className="logout-dialog-actions">
          <button type="button" className="button button-secondary" autoFocus onClick={() => dialog.current?.close()}>Cancel</button>
          <SubmitButton className="button button-danger" pendingText="Deleting…">Yes, delete user</SubmitButton>
        </div>
      </form>
    </dialog>
  </>;
}
