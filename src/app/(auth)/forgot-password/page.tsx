import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <div className="auth-form-wrap login-card">
    <Link className="back-link" href="/login"><ArrowLeft aria-hidden="true" />Back to sign in</Link>
    <div className="auth-form-heading"><span className="login-security-icon"><KeyRound aria-hidden="true" /></span><h2>Reset password</h2><p>Use the current code from your linked authenticator.</p></div>
    <ForgotPasswordForm />
    <p className="login-footer">No authenticator access? Ask the tool custodian.</p>
  </div>;
}
