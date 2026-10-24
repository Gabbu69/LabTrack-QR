"use client";

import { useActionState, useState } from "react";
import { forgotPasswordAction } from "@/app/actions/forgot-password";
import { Notice } from "@/components/feedback/notice";
import { PasswordField } from "@/components/forms/password-field";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  return <form action={action} className="form-stack">
    <Notice error={state.error} />
    <label>Email address<input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required /></label>
    <label>Authenticator code<input name="code" type="text" value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required /></label>
    <PasswordField label="New password" name="password" autoComplete="new-password" minLength={10} maxLength={128} hint="10+ characters, including a letter and a number." required />
    <PasswordField label="Confirm new password" name="confirmation" autoComplete="new-password" minLength={10} maxLength={128} required />
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</button>
  </form>;
}
