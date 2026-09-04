import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole, Profile } from "@/types/app";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const getProfile = cache(async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return profile as Profile | null;
});

export async function requireProfile(roles?: AppRole[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "disabled") redirect("/login?error=This account has been disabled. Contact the tool custodian.");
  if (roles && !roles.includes(profile.role)) redirect("/dashboard?error=You do not have access to that page.");
  return profile;
}

export async function requireActiveProfile(roles?: AppRole[]) {
  const profile = await requireProfile(roles);
  if (profile.status !== "active") redirect("/dashboard");
  return profile;
}

export async function requireCustodian() {
  return requireActiveProfile(["custodian"]);
}

export async function requireStaff() {
  return requireActiveProfile(["custodian", "instructor"]);
}
