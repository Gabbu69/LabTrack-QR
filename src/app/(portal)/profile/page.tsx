import Image from "next/image";
import Link from "next/link";
import { Camera, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { updateProfileAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSharedDemoIdentity, SHARED_DEMO_ACCOUNT_NOTICE } from "@/lib/demo-identities";
import { ProfilePhotoPicker } from "@/components/forms/profile-photo-picker";
import { loadProfileMetadata } from "@/lib/profile-metadata";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const profile = await requireProfile();
  const query = await searchParams;
  const supabase = await createClient();
  // User metadata can be newer than the current JWT after a profile edit.
  const { program, programEditable } = await loadProfileMetadata(supabase, profile);
  let photoUrl: string | null = null;
  if (profile.photo_path) {
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(profile.photo_path, 300);
    photoUrl = data?.signedUrl ?? null;
  }
  return (
    <div className="page-wrap narrow-page">
      <PageHeader eyebrow="ACCOUNT" title="PERSONAL PROFILE" description="Manage your details, picture, and security." />
      <Notice error={query.error} message={query.message} />
      {!programEditable && <Notice type="info">Your profile is available, but Course / Program could not be refreshed. Reload the page to edit that field. Your saved course will be kept.</Notice>}
      <section className="profile-security" aria-labelledby="profile-password-title">
        <KeyRound aria-hidden="true" />
        <div><h2 id="profile-password-title">Account password</h2><p>{isSharedDemoIdentity(profile) ? SHARED_DEMO_ACCOUNT_NOTICE : "Use a private password you do not share with others."}</p></div>
        {!isSharedDemoIdentity(profile) && <Link href="/change-password" className="button button-secondary">Change password</Link>}
      </section>
      <section className="profile-security" aria-labelledby="profile-security-title">
        <ShieldCheck aria-hidden="true" />
        <div><h2 id="profile-security-title">Password recovery</h2><p>{profile.data_scope === "demo" ? "Ask the tool custodian for help with a shared demo account." : "Link an authenticator once so you can reset a forgotten password. Everyday sign-in uses your password and Turnstile."}</p></div>
        {profile.data_scope !== "demo" && <Link href="/two-factor?manage=1" className="button button-secondary"><Smartphone aria-hidden="true" />Recovery authenticator</Link>}
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
          <label className="field"><span>Course / Program</span><input name="program" maxLength={80} defaultValue={program} disabled={!programEditable} placeholder="e.g. Aircraft Maintenance Technology" /></label>
          <label className="field"><span>Contact number</span><input name="contact_number" inputMode="tel" defaultValue={profile.contact_number ?? ""} /></label>
          <ProfilePhotoPicker initialUrl={photoUrl} />
          <div className="form-footer full"><span><ShieldCheck aria-hidden="true" />Only the custodian can change your role.</span><SubmitButton>Save profile</SubmitButton></div>
        </form>
      </section>
    </div>
  );
}
