import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LabTrackMark } from "@/components/branding/labtrack-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-brand-panel">
      <Link className="auth-brand" href="/login"><LabTrackMark /><span className="auth-lockup"><small>AISAT DAVAO</small><strong>LABTRACK <b>QR</b></strong></span></Link>
      <div className="auth-brand-copy"><p className="school-kicker">LABORATORY TOOL MANAGEMENT</p><h1>Track tools.<br /><span>Keep it simple.</span></h1><p>Borrow, return, and track laboratory tools.</p><ol className="auth-workflow"><li><span>1</span>Identify the student</li><li><span>2</span>Scan the tools</li><li><span>3</span>Review and confirm</li></ol></div>
      <div className="auth-trust"><ShieldCheck aria-hidden="true" /><span><strong>Your account. Your authenticator.</strong><small>Personal accounts use a password and a six-digit authenticator code.</small></span></div>
    </section>
    <section className="auth-form-panel">{children}</section>
  </main>;
}
