"use server";

import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { readCustodianInvitation } from "@/lib/custodian-invitation";
import { requireSupabaseSecret } from "@/lib/server-env";
import { consumeLoginAttempt } from "@/lib/login-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordSchema } from "@/lib/validation";

export async function createCustodianAccountAction(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const token = String(form.get("invitation") ?? "");
  let invitation;
  try { invitation = readCustodianInvitation(token, requireSupabaseSecret()); }
  catch { return { error: "Custodian setup is temporarily unavailable. Please try again later." }; }
  if (!invitation) return { error: "This setup link is invalid or expired. Ask the project owner for a new link." };
  const password = passwordSchema.safeParse({ password: String(form.get("password") ?? ""), confirmation: String(form.get("confirmation") ?? "") });
  if (!password.success) return { error: "Choose a password of at least 10 characters with a letter and a number. Enter the same password twice." };
  try {
    const fingerprint = createHash("sha256").update(token).digest("hex");
    if (!await consumeLoginAttempt(`custodian-setup:${fingerprint}`)) return { error: "Too many setup attempts. Wait 15 minutes before trying again." };
    const admin = createAdminClient();
    // Email uniqueness prevents replay from replacing an existing account. Never update an existing
    // user's password, role, MFA factors, or profile through a setup invitation.
    const { data, error } = await admin.auth.admin.createUser({
      email: invitation.email, password: password.data.password, email_confirm: true,
      user_metadata: { full_name: invitation.name },
      app_metadata: { labtrack_staff_role: "custodian", labtrack_data_scope: "operational" },
    });
    if (error || !data.user) return { error: "The account could not be created. If you already completed setup, sign in with your chosen password. Otherwise ask the project owner for help." };
    // Auth can create the profile before staff metadata is available. Assign
    // staff access only to the new ID returned by this successful create call.
    // The owner chose this private password, so no temporary change is needed.
    const { data: profile, error: profileError } = await admin.from("profiles")
      .update({ full_name: invitation.name, role: "custodian", status: "active", data_scope: "operational", must_change_password: false, student_id: null }).eq("id", data.user.id)
      .select("role,status,data_scope,must_change_password").single();
    if (profileError || !profile || profile.role !== "custodian" || profile.data_scope !== "operational" || profile.status !== "active") {
      return { error: "Your account was created, but custodian access needs the project owner's attention. Do not repeat setup." };
    }
  } catch { return { error: "Setup could not be completed. If you already created your account, sign in. Otherwise try again later." }; }
  // Do not create an authenticated session using an admin credential. The owner
  // now signs in with their chosen password and Turnstile.
  redirect("/login?message=Custodian%20account%20created.%20Sign%20in%20with%20your%20password%20and%20Turnstile.%20Link%20a%20recovery%20authenticator%20from%20Profile.");
}
