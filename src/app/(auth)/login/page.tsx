import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const query = await searchParams;
  return <div className="auth-form-wrap">
    <div className="auth-form-heading"><span className="industrial-icon"><LogIn aria-hidden="true" /></span><h2>Sign in to the tool crib</h2><p>Use the account prepared by your laboratory custodian.</p></div>
    {!isSupabaseConfigured() && <Notice type="info">Local interface preview is ready. Supabase credentials are still required for sign-in.</Notice>}
    {query.error && <Notice type="error">{query.error}</Notice>}
    {query.message && <Notice type="success">{query.message}</Notice>}
    <form action={loginAction} className="form-stack">
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@school.edu" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
    <div className="auth-links"><p>Student mechanic leader? <Link href="/register">Register an account</Link></p><p className="help-copy">Forgot your password? Ask the tool custodian for a one-time temporary password.</p></div>
  </div>;
}
