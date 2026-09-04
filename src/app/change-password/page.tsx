import { KeyRound } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireProfile } from "@/lib/auth";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireProfile();
  const query = await searchParams;
  return <main className="single-form-page"><section className="single-form-card">
    <span className="industrial-icon"><KeyRound aria-hidden="true" /></span><h1>Set a private password</h1><p>Your temporary password worked. Replace it before using LabTrack QR.</p>
    {query.error && <Notice type="error">{query.error}</Notice>}
    <form action={changePasswordAction} className="form-stack">
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /><small>Use at least 10 characters with a letter and a number.</small></label>
      <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
      <SubmitButton pendingText="Saving password…">Save password and continue</SubmitButton>
    </form>
  </section></main>;
}
