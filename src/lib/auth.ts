import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/session-policy";
import { redirect } from "next/navigation";
import type { AppRole, Profile } from "@/types/app";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { accessFailure, type AccessOptions } from "@/lib/access-policy";

export const getAuthContext = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) return null;
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return null;
  const sessionId = data?.claims?.session_id;
  if (typeof sessionId !== "string") return null;
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, userId, sessionId);
  if (!session) return null;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error("Account details could not be loaded. Please try again.");
  return profile ? { profile: profile as Profile, aal: data?.claims?.aal, session } : null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const context = await getAuthContext();
  return context && !accessFailure(context.profile, {}, context.aal) ? context.profile : null;
});

export async function requireProfile(roles?: AppRole[], options: AccessOptions = {}) {
  const context = await getAuthContext();
  const profile = context?.profile ?? null;
  const failure = accessFailure(profile, { ...options, roles }, context?.aal);
  if (failure?.status === 401) redirect("/login");
  if (failure?.code === "MFA_REQUIRED") redirect("/two-factor");
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
