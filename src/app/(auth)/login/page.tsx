import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PasswordField } from "@/components/forms/password-field";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const query = await searchParams;
  return <div className="auth-form-wrap login-card">
    <div className="auth-form-heading"><span className="login-security-icon"><ShieldCheck aria-hidden="true" /></span><h2>Sign in to LabTrack</h2><p>Use the account provided by your tool custodian.</p></div>
    {!isSupabaseConfigured() && <Notice type="info">Sign-in is temporarily unavailable. Contact the tool custodian.</Notice>}
    <Notice error={query.error} message={query.message} />
    <form action={loginAction} className="form-stack">
      <label>Email address<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@school.edu" required /></label>
      <PasswordField label="Password" name="password" autoComplete="current-password" minLength={8} required />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
    <Link className="login-forgot-password text-link" href="/forgot-password">Forgot password?</Link>
    <p className="login-authenticator-note"><ShieldCheck aria-hidden="true" /><span>Protected by your authenticator app.</span></p>
    <details className="login-access-help"><summary>Need an account?</summary><p>Ask the tool custodian for your sign-in details.</p></details>
    <p className="login-footer">AISAT Davao · Laboratory tool management</p>
  </div>;
}
