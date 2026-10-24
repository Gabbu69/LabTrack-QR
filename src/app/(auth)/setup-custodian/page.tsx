import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { readCustodianInvitation } from "@/lib/custodian-invitation";
import { requireSupabaseSecret } from "@/lib/server-env";
import { CustodianSetupForm } from "@/components/auth/custodian-setup-form";
import { Notice } from "@/components/feedback/notice";

export const metadata = { title: "Set up your custodian account", robots: { index: false, follow: false } };

export default async function CustodianSetupPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const query = await searchParams;
  let invitation = null;
  try { invitation = readCustodianInvitation(query.invitation, requireSupabaseSecret()); } catch { /* Never expose server configuration. */ }
  return <div className="auth-form-wrap">
    <div className="auth-form-heading"><span className="industrial-icon"><ShieldCheck aria-hidden="true" /></span><h2>Set up your custodian account</h2><p>Choose your own LabTrack password. Authenticator setup follows after you sign in.</p></div>
    {invitation && query.invitation ? <CustodianSetupForm token={query.invitation} name={invitation.name} email={invitation.email} /> : <Notice type="info">Use the private setup link provided by the project owner. It creates only the custodian account named in that invitation. If your link expired, ask for a new one.</Notice>}
    <p className="auth-back"><Link href="/login">Back to sign in</Link></p>
  </div>;
}
