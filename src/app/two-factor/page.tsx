import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { LabTrackMark } from "@/components/branding/labtrack-mark";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { Notice } from "@/components/feedback/notice";
import { getAuthContext, requireProfile } from "@/lib/auth";
import type { MfaFactor } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { isEmailOtpEnabled } from "@/lib/email-otp";

export const metadata = { title: "Two-factor authentication", robots: { index: false, follow: false } };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ manage?: string; message?: string }> }) {
  const profile = await requireProfile(undefined, { allowMfaSetup: true, allowPasswordChange: true });
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (profile.data_scope === "demo") redirect(profile.must_change_password ? "/change-password" : "/profile");
  const query = await searchParams;
  const manage = query.manage === "1";
  if (manage && context.aal !== "aal2" && !context.emailOtpVerified) redirect("/two-factor");
  if ((context.aal === "aal2" || context.emailOtpVerified) && profile.must_change_password) redirect("/change-password");
  if ((context.aal === "aal2" || context.emailOtpVerified) && !manage) redirect("/dashboard");

  let factors: MfaFactor[] = [];
  let unavailable = false;
  let unsupportedFactor = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) unavailable = true;
    else {
      factors = data.totp.map((factor) => ({ id: factor.id, name: factor.friendly_name || "Authenticator" }));
      unsupportedFactor = context.aal !== "aal2" && factors.length === 0 && data.all.some((factor) => factor.status === "verified");
    }
  } catch {
    unavailable = true;
  }
  const enrolling = !manage && factors.length === 0 && !unsupportedFactor;
  if (enrolling && !unavailable && isEmailOtpEnabled()) redirect("/verify-email");
  return (
    <main className="mfa-shell">
      <header className="mfa-header">
        <div className="mfa-brand"><LabTrackMark /><span>LabTrack <b>QR</b></span></div>
        <form action={signOutAction}><button className="button button-secondary" type="submit"><LogOut aria-hidden="true" />Sign out</button></form>
      </header>
      <div className="mfa-main">
        {manage && <Link href="/profile" className="back-link"><ArrowLeft aria-hidden="true" />Back to Profile</Link>}
        <div className="mfa-heading"><ShieldCheck aria-hidden="true" /><div><h1>{manage ? "Two-factor authentication" : enrolling ? "Secure your account" : "Verify your sign-in"}</h1><p>{profile.email}</p></div></div>
        {!unavailable && !unsupportedFactor && <p className="mfa-intro">{manage ? "Your account is protected with authenticator codes." : enrolling ? "An authenticator code is required with your password to access laboratory records." : "Enter your authenticator code to finish signing in."}</p>}
        <Notice message={query.message} />
        {unavailable ? <Notice type="error">Authenticator verification is temporarily unavailable. Try again later or sign out.</Notice> : unsupportedFactor ? <Notice type="error">This account uses a different verification method. Contact the system administrator to restore authenticator access.</Notice> : <TwoFactorForm factors={factors} manage={manage} />}
        {!manage && factors.length > 0 && <p className="mfa-recovery">Lost access to your authenticator? Contact the laboratory custodian. A password reset does not remove two-factor protection.</p>}
      </div>
    </main>
  );
}
