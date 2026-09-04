import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (profile.must_change_password) redirect("/change-password");
  return <AppShell profile={profile}>{children}</AppShell>;
}
