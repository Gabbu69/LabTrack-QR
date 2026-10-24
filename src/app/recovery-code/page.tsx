import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { LabTrackMark } from "@/components/branding/labtrack-mark";
import { RecoveryCodeSetup } from "@/components/auth/two-factor-form";
import { getAuthContext, requireProfile } from "@/lib/auth";

export const metadata = { title: "Recovery code", robots: { index: false, follow: false } };

export default async function RecoveryCodePage() {
  const profile = await requireProfile(undefined, { allowPasswordChange: true });
  const context = await getAuthContext();
  if (profile.data_scope === "demo") redirect("/profile");
  if (context?.aal !== "aal2") redirect("/two-factor");
  return <main className="mfa-shell">
    <header className="mfa-header"><div className="mfa-brand"><LabTrackMark /><span>LabTrack <b>QR</b></span></div><LogoutButton className="button button-secondary" label="Sign out" /></header>
    <div className="mfa-main"><div className="mfa-heading"><ShieldCheck aria-hidden="true" /><div><h1>Authenticator linked</h1><p>{profile.email}</p></div></div><RecoveryCodeSetup nextPath={profile.must_change_password ? "/change-password" : "/dashboard"} /></div>
  </main>;
}
