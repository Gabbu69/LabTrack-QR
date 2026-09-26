import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { isSupabaseConfigured } from "@/lib/env";
import { getDemoAccess } from "@/lib/demo-access";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; demo?: string }> }) {
  const query = await searchParams;
  const demo = await getDemoAccess(query.demo);
  return <div className="auth-form-wrap">
    <div className="auth-form-heading"><span className="industrial-icon"><LogIn aria-hidden="true" /></span><h2>Sign in to the tool crib</h2><p>Use the account prepared by your laboratory custodian.</p></div>
    {!isSupabaseConfigured() && <Notice type="info">Local interface preview is ready. Supabase credentials are still required for sign-in.</Notice>}
    {query.error && <Notice type="error">{query.error}</Notice>}
    {query.message && <Notice type="success">{query.message}</Notice>}
    {demo && <Notice type="info">Your {demo.role} demo account is filled in. Press Sign in to try the app with shared sample records. Do not enter personal information.</Notice>}
    {query.demo && !demo && <Notice type="error">Demo access is temporarily unavailable. Choose another role in the user guide or sign in with your own account.</Notice>}
    <form key={demo?.role ?? "personal"} action={loginAction} className="form-stack">
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@school.edu" defaultValue={demo?.email ?? ""} required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" defaultValue={demo?.password ?? ""} minLength={8} required /></label>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
    <div className="auth-links"><p>Student mechanic leader? <Link href="/register">Register an account</Link></p><p><Link href="/guide">Complete user guide & demo accounts</Link>{demo && <> · <Link href="/login">Use my own account</Link></>}</p><p className="help-copy">Forgot your password? Ask the tool custodian for a one-time temporary password.</p></div>
  </div>;
}
