import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LabTrackMark } from "@/components/branding/labtrack-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-brand-panel">
      <Link className="auth-brand" href="/login"><LabTrackMark /><span className="auth-lockup"><small>AISAT DAVAO</small><strong>LABTRACK <b>QR</b></strong></span></Link>
      <div className="auth-brand-copy"><p className="school-kicker">AVIATION LABORATORY TOOL CONTROL</p><h1>Clear custody.<br />Ready for flight.<br /><span>Every time.</span></h1><p>A focused QR workflow for accountable tool issue and return inside the AISAT Davao aviation laboratory.</p></div>
      <div className="auth-trust"><ShieldCheck aria-hidden="true" /><span><strong>Thesis laboratory system</strong><small>QR identification supports custody records; it does not replace user authentication or aviation safety procedures.</small></span></div>
    </section>
    <section className="auth-form-panel">{children}</section>
  </main>;
}
