import Link from "next/link";
import { UserPlus } from "lucide-react";
import { RegistrationForm } from "@/components/auth/registration-form";
import { isEmailOtpEnabled } from "@/lib/email-otp";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <div className="auth-form-wrap register-wrap">
    <div className="auth-form-heading"><span className="industrial-icon"><UserPlus aria-hidden="true" /></span><h2>Student registration</h2><p>{isEmailOtpEnabled() ? "Create a Student Mechanic Leader account using an email inbox you can access. Verify your email code, then wait for custodian approval before borrowing." : "Create a Student Mechanic Leader account. Set up an authenticator when you sign in, then wait for custodian approval before borrowing."}</p></div>
    <RegistrationForm emailOtpEnabled={isEmailOtpEnabled()} initialError={query.error === "Registration could not be completed. Try again." ? "Your previous registration did not finish. Check your Student ID and email below. If you already have an account, go to sign in or ask the custodian for help." : query.error} />
    <p className="auth-back"><Link href="/login">Back to sign in</Link></p>
  </div>;
}
