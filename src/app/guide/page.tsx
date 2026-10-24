import type { Metadata } from "next";
import { MissionGuide } from "@/components/help/mission-guide";
import { requireProfile } from "@/lib/auth";
import { ApplicationGuide } from "@/components/help/application-guide";

export const metadata: Metadata = { title: "Help & user guide" };
export default async function GuidePage() {
  const profile = await requireProfile();
  return <><MissionGuide initialRole={profile.role} signedIn /><ApplicationGuide /></>;
}
