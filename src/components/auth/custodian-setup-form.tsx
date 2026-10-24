"use client";

import { useActionState } from "react";
import { createCustodianAccountAction } from "@/app/actions/custodian-setup";
import { PasswordField } from "@/components/forms/password-field";
import { Notice } from "@/components/feedback/notice";

export function CustodianSetupForm({ token, name, email }: { token: string; name: string; email: string }) {
  const [state, action, pending] = useActionState(createCustodianAccountAction, {});
  return <form action={action} className="form-stack" aria-busy={pending}>
    <input type="hidden" name="invitation" value={token} />
    <label>Full name<input value={name} readOnly autoComplete="name" /></label>
    <label>Email address<input value={email} readOnly type="email" autoComplete="username" /></label>
    <PasswordField name="password" label="Create password" autoComplete="new-password" minLength={10} maxLength={128} required hint="At least 10 characters, including a letter and a number." />
    <PasswordField name="confirmation" label="Confirm password" autoComplete="new-password" minLength={10} maxLength={128} required />
    <Notice error={state.error} />
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating your account…" : "Create custodian account"}</button>
    <p className="help-copy">Next: sign in with this email and password, then scan your setup QR in your authenticator app. Your account opens the real laboratory workspace.</p>
  </form>;
}
