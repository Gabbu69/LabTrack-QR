import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole, Profile } from "@/types/app";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { accessFailure, type AccessOptions } from "@/lib/access-policy";

export const getProfile = cache(async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return null;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error("Account details could not be loaded. Please try again.");
  return profile as Profile | null;
});

export async function requireProfile(roles?: AppRole[], options: AccessOptions = {}) {
  const profile = await getProfile();
  const failure = accessFailure(profile, { ...options, roles });
  if (failure?.status === 401) redirect("/login");
  if (failure?.code === "PASSWORD_CHANGE_REQUIRED") redirect("/change-password");
  if (failure) redirect(`${failure.code === "ACCOUNT_DISABLED" ? "/login" : "/dashboard"}?error=${encodeURIComponent(failure.message)}`);
  return profile!;
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
