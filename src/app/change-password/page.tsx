import { KeyRound } from "lucide-react";
import Link from "next/link";
import { changePasswordAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireProfile } from "@/lib/auth";
import { isSharedDemoIdentity, SHARED_DEMO_ACCOUNT_NOTICE } from "@/lib/demo-identities";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await requireProfile(undefined, { allowPasswordChange: true });
  const query = await searchParams;
  if (isSharedDemoIdentity(profile)) return <main className="single-form-page"><section className="single-form-card">
    <span className="industrial-icon"><KeyRound aria-hidden="true" /></span><h1>Shared demonstration account</h1>
    <p>{SHARED_DEMO_ACCOUNT_NOTICE}</p>
    {query.error && <Notice type="error">{query.error}</Notice>}
    <Link href="/dashboard" className="button button-primary">Return to dashboard</Link>
  </section></main>;
  return <main className="single-form-page"><section className="single-form-card">
    <span className="industrial-icon"><KeyRound aria-hidden="true" /></span><h1>Set a private password</h1><p>{profile.must_change_password ? "Your temporary password worked. Replace it before using LabTrack QR." : "Choose a private password for your LabTrack QR account."}</p>
    {query.error && <Notice type="error">{query.error}</Notice>}
    <form action={changePasswordAction} className="form-stack">
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /><small>Use at least 10 characters with a letter and a number.</small></label>
      <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
      <SubmitButton pendingText="Saving password…">Save password and continue</SubmitButton>
    </form>
  </section></main>;
}
