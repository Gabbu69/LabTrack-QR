import Image from "next/image";
import Link from "next/link";
import { Camera, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { updateProfileAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSharedDemoIdentity, SHARED_DEMO_ACCOUNT_NOTICE } from "@/lib/demo-identities";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const profile = await requireProfile();
  const context = await getAuthContext();
  const query = await searchParams;
  let photoUrl: string | null = null;
  if (profile.photo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(profile.photo_path, 300);
    photoUrl = data?.signedUrl ?? null;
  }
  return (
    <div className="page-wrap narrow-page">
      <PageHeader eyebrow="ACCOUNT" title="PERSONAL PROFILE" description="Keep your contact and student details accurate for custody records." />
      <Notice error={query.error} message={query.message} />
      <section className="profile-security" aria-labelledby="profile-password-title">
        <KeyRound aria-hidden="true" />
        <div><h2 id="profile-password-title">Account password</h2><p>{isSharedDemoIdentity(profile) ? SHARED_DEMO_ACCOUNT_NOTICE : "Use a private password you do not share with others."}</p></div>
        {!isSharedDemoIdentity(profile) && <Link href="/change-password" className="button button-secondary">Change password</Link>}
      </section>
      <section className="profile-security" aria-labelledby="profile-security-title">
        <ShieldCheck aria-hidden="true" />
        <div><h2 id="profile-security-title">Two-factor authentication</h2><p>{profile.data_scope === "demo" ? "Shared demo accounts are exempt. Personal accounts require a sign-in verification code." : context?.emailOtpVerified ? "Your password and an email verification code protect your account." : "Your password and authenticator code protect your account."}</p></div>
        {profile.data_scope !== "demo" && <Link href="/two-factor?manage=1" className="button button-secondary"><Smartphone aria-hidden="true" />{context?.emailOtpVerified ? "Add an authenticator" : "Manage authenticators"}</Link>}
      </section>
      <section className="content-card profile-card">
        <div className="profile-summary">
          <div className="profile-photo">{photoUrl ? <Image src={photoUrl} alt="Profile photo" fill sizes="112px" unoptimized /> : <Camera aria-hidden="true" />}</div>
          <div><h2>{profile.full_name}</h2><p>{profile.email}</p><div className="chip-row"><StatusBadge value={profile.role} /><StatusBadge value={profile.status} /></div></div>
        </div>
        <form action={updateProfileAction} className="form-grid" encType="multipart/form-data">
          <label className="field full"><span>Full name</span><input name="full_name" required defaultValue={profile.full_name} /></label>
          <label className="field"><span>Student ID</span><input name="student_id" required={profile.role === "student"} defaultValue={profile.student_id ?? ""} disabled={profile.role !== "student"} /></label>
          <label className="field"><span>Year / Section</span><input name="year_section" defaultValue={profile.year_section ?? ""} disabled={profile.role !== "student"} /></label>
          <label className="field"><span>Group number</span><input name="group_number" defaultValue={profile.group_number ?? ""} disabled={profile.role !== "student"} /></label>
          <label className="field"><span>Contact number</span><input name="contact_number" inputMode="tel" defaultValue={profile.contact_number ?? ""} /></label>
          <label className="field full"><span>Profile photo <small>optional · JPEG, PNG, or WebP · max 2 MB</small></span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <div className="form-footer full"><span><ShieldCheck aria-hidden="true" />Role and approval status can only be changed by a custodian.</span><SubmitButton>Save profile</SubmitButton></div>
        </form>
      </section>
    </div>
  );
}
