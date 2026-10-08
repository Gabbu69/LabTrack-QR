import { redirect } from "next/navigation";
import { LogOut, Mail } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { LabTrackMark } from "@/components/branding/labtrack-mark";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { Notice } from "@/components/feedback/notice";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { secondFactorPath } from "@/lib/email-otp";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Verify your email code", robots: { index: false, follow: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const profile = await requireProfile(undefined, { allowMfaSetup: true, allowPasswordChange: true });
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (profile.data_scope === "demo" || context.aal === "aal2" || context.emailOtpVerified) redirect(profile.must_change_password ? "/change-password" : "/dashboard");
  let path: string | null = null;
  try { path = await secondFactorPath(await createClient()); }
  catch { /* Keep access closed and offer a retry if the provider is unavailable. */ }
  if (path && path !== "/verify-email") redirect(path);
  const query = await searchParams;
  return <main className="mfa-shell">
    <header className="mfa-header">
      <div className="mfa-brand"><LabTrackMark /><span>LabTrack <b>QR</b></span></div>
      <form action={signOutAction}><button className="button button-secondary" type="submit"><LogOut aria-hidden="true" />Sign out</button></form>
    </header>
    <div className="mfa-main">
      <div className="mfa-heading"><Mail aria-hidden="true" /><div><h1>Verify your email</h1><p>{profile.email}</p></div></div>
      <p className="mfa-intro">Your password was accepted. Verify the code sent to your email before entering LabTrack.</p>
      <Notice error={query.error} message={query.message} />
      {path ? <EmailOtpForm /> : <Notice type="error">Account verification is temporarily unavailable. Reload this page to try again or sign out.</Notice>}
      <p className="mfa-recovery">Never share your verification code. Custodian approval is still required before borrowing tools.</p>
    </div>
  </main>;
}
