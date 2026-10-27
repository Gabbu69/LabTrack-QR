"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/login-limit";
import { isSharedDemoIdentity, SHARED_DEMO_ACCOUNT_NOTICE } from "@/lib/demo-identities";
import { authCookieOptions, IDLE_SECONDS, SESSION_COOKIE, signSession } from "@/lib/session-policy";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireProfile } from "@/lib/auth";
import { performPasswordUpdate } from "@/lib/password-operation";
import { normalizeProfilePhoto } from "@/lib/profile-photo";
import { loginSchema, passwordSchema, profileSchema } from "@/lib/validation";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";
import { recordTurnstileSession } from "@/lib/turnstile-session";
import { signInErrorMessage } from "@/lib/auth-errors";
import { type RegistrationState } from "@/lib/registration";
import { createAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function go(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  if (!isSupabaseConfigured()) go("/login", "error", "Supabase is not configured yet. Follow SETUP.md to connect the project.");
  const parsed = loginSchema.safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) go("/login", "error", parsed.error.issues[0]?.message ?? "Check your login details.");
  let allowed = false;
  try { allowed = await consumeLoginAttempt(parsed.data.email); }
  catch { go("/login", "error", "Sign-in is temporarily unavailable. Please try again later."); }
  if (!allowed) go("/login", "error", "Too many sign-in attempts. Please wait 15 minutes before trying again.");
  if (!await verifyTurnstile(value(formData, "cf-turnstile-response"), "login")) {
    redirect(`/login?error=${encodeURIComponent(TURNSTILE_ERROR)}&reset=${crypto.randomUUID()}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // A fresh key also resets consecutive failures with the same error message.
    redirect(`/login?error=${encodeURIComponent(signInErrorMessage(error ?? {}))}&reset=${crypto.randomUUID()}`);
  }
  try { await clearLoginAttempts(parsed.data.email); }
  catch { await supabase.auth.signOut(); go("/login", "error", "Sign-in is temporarily unavailable. Please try again later."); }
  const { data: profile } = await supabase.from("profiles").select("status,must_change_password,data_scope").eq("id", data.user.id).maybeSingle();
  if (!profile) { await supabase.auth.signOut(); go("/login", "error", "Your profile is not ready. Ask the custodian for help."); }
  if (profile.status === "disabled") { await supabase.auth.signOut(); go("/login", "error", "This account has been disabled. Contact the custodian."); }
  const { data: verified, error: claimsError } = await supabase.auth.getClaims();
  const sessionId = verified?.claims?.session_id;
  if (claimsError || verified?.claims?.sub !== data.user.id || typeof sessionId !== "string") { await supabase.auth.signOut(); go("/login", "error", "Session could not be established. Please sign in again."); }
  const now = Math.floor(Date.now() / 1000);
  try { await recordTurnstileSession(data.user.id, sessionId, now); }
  catch { await supabase.auth.signOut(); go("/login", "error", "Secure sign-in is temporarily unavailable. Please try again later."); }
  (await cookies()).set(SESSION_COOKIE, signSession({ user: data.user.id, session: sessionId, started: now, seen: now }), { ...authCookieOptions, maxAge: IDLE_SECONDS });
  redirect(profile.must_change_password ? "/change-password" : "/dashboard");
}

export async function registerAction(_formData: FormData): Promise<RegistrationState> {
  void _formData;
  return { error: "Self-registration is closed. Ask the tool custodian to create your account." };
}

export async function registerFormAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  return registerAction(formData);
}

export async function changePasswordAction(formData: FormData) {
  const profile = await requireProfile(undefined, { allowPasswordChange: true });
  if (isSharedDemoIdentity(profile)) go("/change-password", "error", SHARED_DEMO_ACCOUNT_NOTICE);
  const parsed = passwordSchema.safeParse({ password: value(formData, "password"), confirmation: value(formData, "confirmation") });
  if (!parsed.success) go("/change-password", "error", parsed.error.issues[0]?.message ?? "Check the new password.");
  // The application session has already passed password + Turnstile. Recovery
  // factors must not force an AAL2 challenge during a routine password change.
  const admin = createAdminClient();
  const result = await performPasswordUpdate(profile, () => admin.auth.admin.updateUserById(profile.id, { password: parsed.data.password }), false);
  if (!result.ok) go("/change-password", "error", result.message);
  revalidatePath("/", "layout");
  redirect(profile.status === "disabled" ? "/login" : "/dashboard");
}

export async function updateProfileAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const parsed = profileSchema.safeParse({ fullName: value(formData, "full_name"), studentId: value(formData, "student_id"), yearSection: value(formData, "year_section"), program: value(formData, "program"), contactNumber: value(formData, "contact_number") });
  if (!parsed.success || (profile.role === "student" && parsed.data.studentId.length < 2)) go("/profile", "error", "Check your profile details and field lengths.");
  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (profile.status !== "active") go("/profile", "error", "A custodian must approve your account before you can upload a photo.");
    if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      go("/profile", "error", "Profile photos must be JPEG, PNG, or WebP and no larger than 2 MB.");
    }
    let normalized: Buffer;
    try { normalized = await normalizeProfilePhoto(photo); }
    catch (error) { go("/profile", "error", error instanceof Error ? error.message : "Choose a valid profile photo."); }
    photoPath = `${profile.id}/profile-${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from("profile-photos").upload(photoPath, normalized, { contentType: "image/webp", upsert: false });
    if (error) go("/profile", "error", "The profile photo could not be uploaded.");
  }
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: value(formData, "full_name"), p_student_id: value(formData, "student_id"),
    p_year_section: value(formData, "year_section"), p_group_number: profile.group_number ?? "",
    p_contact_number: value(formData, "contact_number"),
    ...(photoPath ? { p_photo_path: photoPath } : {}),
  });
  if (error) {
    if (photoPath) await supabase.storage.from("profile-photos").remove([photoPath]);
    go("/profile", "error", "Profile could not be saved. Check that your Student ID is not already in use and try again.");
  }
  if (photoPath && profile.photo_path) await supabase.storage.from("profile-photos").remove([profile.photo_path]);
  // Disabled fields are omitted by the browser. Keep stored metadata when its
  // freshness read was unavailable, while still allowing other profile edits.
  const programError = formData.has("program")
    ? (await supabase.auth.updateUser({ data: { program: parsed.data.program } })).error
    : null;
  revalidatePath("/profile");
  if (programError) go("/profile", "error", "Your profile was saved, but Course / Program could not be updated. Please retry that field.");
  go("/profile", "message", "Profile updated.");
}

export async function signOutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
