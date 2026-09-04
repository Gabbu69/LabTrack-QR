import Link from "next/link";
import { UserPlus } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <div className="auth-form-wrap register-wrap">
    <div className="auth-form-heading"><span className="industrial-icon"><UserPlus aria-hidden="true" /></span><h2>Student registration</h2><p>Create a Student Mechanic Leader account. Approval is required before borrowing.</p></div>
    {query.error && <Notice type="error">{query.error}</Notice>}
    <form action={registerAction} className="form-grid">
      <label className="full">Full name<input name="full_name" autoComplete="name" required /></label>
      <label>Student ID<input name="student_id" required /></label>
      <label>Year / Section<input name="year_section" placeholder="2nd Year / AMT-A" required /></label>
      <label>Group number<input name="group_number" placeholder="Group 3" required /></label>
      <label>Contact number<input name="contact_number" inputMode="tel" autoComplete="tel" required /></label>
      <label className="full">Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label className="full">Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters for registration.</small></label>
      <div className="full"><SubmitButton pendingText="Submitting registration…">Submit registration</SubmitButton></div>
    </form>
    <p className="auth-back"><Link href="/login">Back to sign in</Link></p>
  </div>;
}
