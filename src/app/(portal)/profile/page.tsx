import Image from "next/image";
import { Camera, ShieldCheck } from "lucide-react";
import { updateProfileAction } from "@/app/actions/auth";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const profile = await requireProfile();
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
