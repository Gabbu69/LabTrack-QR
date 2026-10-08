"use client";

import { useActionState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { resendEmailOtpAction, verifyEmailOtpAction } from "@/app/actions/email-otp";
import { Notice } from "@/components/feedback/notice";
import type { EmailOtpState } from "@/lib/email-otp";

const initialState: EmailOtpState = {};

export function EmailOtpForm() {
  const [verification, verify, verifying] = useActionState(verifyEmailOtpAction, initialState);
  const [delivery, resend, sending] = useActionState(resendEmailOtpAction, initialState);
  return <div className="mfa-form-content">
    <form action={verify} className="form-stack mfa-code-form">
      <label>6-digit email code<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required className="mfa-code-input" aria-describedby="email-code-help" /></label>
      <p id="email-code-help" className="mfa-help">Enter the latest code from your inbox. Codes expire after 10 minutes.</p>
      <Notice error={verification.error} />
      <button type="submit" className="button button-primary" disabled={verifying || sending}><ShieldCheck aria-hidden="true" />{verifying ? "Verifying..." : "Verify and continue"}</button>
    </form>
    <form action={resend} className="form-stack">
      <p className="mfa-help">No email yet? Check your spam folder. Wait at least 60 seconds before requesting another code.</p>
      <Notice error={delivery.error} message={delivery.message} />
      <button type="submit" className="button button-secondary" disabled={verifying || sending}><Mail aria-hidden="true" />{sending ? "Sending code..." : "Resend email code"}</button>
    </form>
  </div>;
}
