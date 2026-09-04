import { Info } from "lucide-react";
import { QrCard } from "@/components/qr/qr-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth";
import { studentQrPayload } from "@/lib/qr";

export const metadata = { title: "My QR" };

export default async function MyQrPage() {
  const profile = await requireProfile(["student"]);
  return (
    <div className="page-wrap narrow-page">
      <PageHeader eyebrow="BORROWER IDENTIFICATION" title="MY PERSONAL QR" description="Present this QR to the tool custodian. It identifies your profile but does not sign anyone in." />
      <div className="qr-page-grid"><QrCard payload={studentQrPayload(profile.qr_token)} label={profile.full_name} caption={`${profile.student_id} · ${profile.year_section ?? "Section not set"} · Group ${profile.group_number ?? "—"}`} />
        <aside className="instruction-card"><Info aria-hidden="true" /><h2>How to use it</h2><ol><li>Open this page at the tool counter.</li><li>Let the custodian scan the full QR square.</li><li>Confirm your name and the tools before checkout.</li></ol><p>Do not share screenshots of your QR unnecessarily. The custodian still verifies your approved profile.</p></aside>
      </div>
    </div>
  );
}
