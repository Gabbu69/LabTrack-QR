"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireProfile } from "@/lib/auth";
import { loginSchema, passwordSchema, registrationSchema } from "@/lib/validation";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function go(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  if (!isSupabaseConfigured()) go("/login", "error", "Supabase is not configured yet. Follow SETUP.md to connect the project.");
  const parsed = loginSchema.safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) go("/login", "error", parsed.error.issues[0]?.message ?? "Check your login details.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) go("/login", "error", "Email or password is incorrect.");
  const { data: profile } = await supabase.from("profiles").select("status,must_change_password").eq("id", data.user.id).maybeSingle();
  if (!profile) { await supabase.auth.signOut(); go("/login", "error", "Your profile is not ready. Ask the custodian for help."); }
  if (profile.status === "disabled") { await supabase.auth.signOut(); go("/login", "error", "This account has been disabled. Contact the custodian."); }
  redirect(profile.must_change_password ? "/change-password" : "/dashboard");
}

export async function registerAction(formData: FormData) {
  if (!isSupabaseConfigured()) go("/register", "error", "Supabase is not configured yet. Follow SETUP.md to connect the project.");
  const parsed = registrationSchema.safeParse({
    email: value(formData, "email"), password: value(formData, "password"), fullName: value(formData, "full_name"),
    studentId: value(formData, "student_id"), yearSection: value(formData, "year_section"),
    groupNumber: value(formData, "group_number"), contactNumber: value(formData, "contact_number"),
  });
  if (!parsed.success) go("/register", "error", parsed.error.issues[0]?.message ?? "Check the registration form.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, student_id: parsed.data.studentId, year_section: parsed.data.yearSection, group_number: parsed.data.groupNumber, contact_number: parsed.data.contactNumber } },
  });
  if (error) go("/register", "error", error.message.includes("registered") ? "An account already uses this email." : "Registration could not be completed. Try again.");
  await supabase.auth.signOut();
  go("/login", "message", "Registration received. A custodian must approve your account before you can borrow tools.");
}

export async function changePasswordAction(formData: FormData) {
  const profile = await requireProfile();
  const parsed = passwordSchema.safeParse({ password: value(formData, "password"), confirmation: value(formData, "confirmation") });
  if (!parsed.success) go("/change-password", "error", parsed.error.issues[0]?.message ?? "Check the new password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) go("/change-password", "error", "The password could not be changed. Try again.");
  const { error: profileError } = await supabase.rpc("complete_password_change");
  if (profileError) go("/change-password", "error", "Password changed, but your profile needs custodian review.");
  revalidatePath("/", "layout");
  redirect(profile.status === "disabled" ? "/login" : "/dashboard");
}

export async function updateProfileAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      go("/profile", "error", "Profile photos must be JPEG, PNG, or WebP and no larger than 2 MB.");
    }
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    photoPath = `${profile.id}/profile-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("profile-photos").upload(photoPath, photo, { contentType: photo.type, upsert: false });
    if (error) go("/profile", "error", "The profile photo could not be uploaded.");
  }
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: value(formData, "full_name"), p_student_id: value(formData, "student_id"),
    p_year_section: value(formData, "year_section"), p_group_number: value(formData, "group_number"),
    p_contact_number: value(formData, "contact_number"), p_photo_path: photoPath,
  });
  if (error) go("/profile", "error", error.message);
  revalidatePath("/profile");
  go("/profile", "message", "Profile updated.");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
