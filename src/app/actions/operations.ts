"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { performPasswordUpdate } from "@/lib/password-operation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCustodian, requireProfile } from "@/lib/auth";
import { normalizeAssetPrefix } from "@/lib/asset-code";
import { toolBatchSchema } from "@/lib/validation";
import { isSharedDemoIdentity, SHARED_DEMO_ACCOUNT_NOTICE } from "@/lib/demo-identities";
import { studentIdInUse } from "@/lib/registration";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function go(path: string, key: "error" | "message", message: string): never { redirect(`${path}?${key}=${encodeURIComponent(message)}`); }

export async function createToolBatchAction(formData: FormData) {
  await requireCustodian();
  const parsed = toolBatchSchema.safeParse({ toolName: value(formData, "tool_name"), description: value(formData, "description"), category: value(formData, "category"), quantity: value(formData, "quantity"), codePrefix: value(formData, "code_prefix"), condition: value(formData, "condition") });
  if (!parsed.success) go("/tools", "error", parsed.error.issues[0]?.message ?? "Check the tool details.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tool_batch", { p_tool_name: parsed.data.toolName, p_description: parsed.data.description, p_category: parsed.data.category, p_quantity: parsed.data.quantity, p_code_prefix: normalizeAssetPrefix(parsed.data.codePrefix), p_condition: parsed.data.condition });
  if (error) go("/tools", "error", "The change could not be completed. Check the details, reload the record, and try again.");
  revalidatePath("/tools"); revalidatePath("/dashboard");
  const batchId = data?.[0]?.creation_batch_id;
  if (batchId) redirect(`/tools/labels?batch=${batchId}`);
  go("/tools", "message", `${data?.length ?? parsed.data.quantity} individually coded tool assets created.`);
}

export async function updateToolAction(formData: FormData) {
  await requireCustodian();
  const parsed = z.object({
    toolId: z.uuid(), toolName: z.string().trim().min(2).max(120), description: z.string().trim().max(1000),
    category: z.string().trim().min(2).max(80), condition: z.enum(["good", "fair", "damaged"]),
    status: z.enum(["available", "borrowed", "missing", "unavailable", "archived"]),
  }).safeParse({ toolId: value(formData, "tool_id"), toolName: value(formData, "tool_name"), description: value(formData, "description"), category: value(formData, "category"), condition: value(formData, "condition"), status: value(formData, "status") });
  if (!parsed.success) go(`/tools/${value(formData, "tool_id")}`, "error", parsed.error.issues[0]?.message ?? "Check the tool details.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tool", { p_tool_id: parsed.data.toolId, p_tool_name: parsed.data.toolName, p_description: parsed.data.description, p_category: parsed.data.category, p_condition: parsed.data.condition, p_status: parsed.data.status });
  if (error) go(`/tools/${parsed.data.toolId}`, "error", "The change could not be completed. Check the details, reload the record, and try again.");
  revalidatePath("/tools"); revalidatePath(`/tools/${parsed.data.toolId}`); revalidatePath("/dashboard");
  go(`/tools/${parsed.data.toolId}`, "message", "Tool record updated.");
}

export async function setProfileStatusAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ profileId: z.uuid(), status: z.enum(["pending", "active", "disabled"]) }).safeParse({ profileId: value(formData, "profile_id"), status: value(formData, "status") });
  if (!parsed.success) go("/users", "error", "Invalid account update.");
  if (parsed.data.profileId === actor.id && parsed.data.status !== "active") go("/users", "error", "You cannot deactivate your current account.");
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("email,data_scope").eq("id", parsed.data.profileId).maybeSingle();
  if (!target || target.data_scope !== actor.data_scope) go("/users", "error", "Account not found in your scope.");
  if (isSharedDemoIdentity(target) && parsed.data.status !== "active") go("/users", "error", SHARED_DEMO_ACCOUNT_NOTICE);
  const { error } = await supabase.rpc("set_profile_status", { p_profile_id: parsed.data.profileId, p_status: parsed.data.status });
  if (error) go("/users", "error", "The change could not be completed. Check the details, reload the record, and try again.");
  revalidatePath("/users");
  go("/users", "message", "Account status updated.");
}

export async function createStaffAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().pipe(z.email()), role: z.enum(["custodian", "instructor"]), temporaryPassword: z.string().min(10).max(128) }).safeParse({ fullName: value(formData, "full_name"), email: value(formData, "email"), role: value(formData, "role"), temporaryPassword: value(formData, "temporary_password") });
  if (!parsed.success) go("/users", "error", parsed.error.issues[0]?.message ?? "Check the staff account details.");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.temporaryPassword, email_confirm: true, user_metadata: { full_name: parsed.data.fullName }, app_metadata: { labtrack_staff_role: parsed.data.role, labtrack_data_scope: actor.data_scope, labtrack_managed_account: true } });
  if (error) go("/users", "error", "The change could not be completed. Check the details, reload the record, and try again.");
  if (!data.user) go("/users", "error", "Staff account could not be created.");
  const { error: profileError } = await admin.from("profiles").update({ full_name: parsed.data.fullName, role: parsed.data.role, data_scope: actor.data_scope, status: "active", student_id: null, must_change_password: true }).eq("id", data.user.id);
  if (profileError) go("/users", "error", "Account was created but staff access could not be assigned. Contact the deployment owner before retrying.");
  revalidatePath("/users");
  go("/users", "message", "Staff account created. Give the temporary password directly to the staff member.");
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ profileId: z.uuid(), email: z.string().trim().toLowerCase().pipe(z.email()) })
    .safeParse({ profileId: value(formData, "profile_id"), email: value(formData, "confirmation_email") });
  if (!parsed.success) go("/users", "error", "Invalid account deletion. Reload and try again.");
  const { profileId, email } = parsed.data;
  if (profileId === actor.id) go("/users", "error", "You cannot delete your current account.");
  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase.from("profiles").select("id,email,data_scope").eq("id", profileId).maybeSingle();
  if (targetError || !target || target.data_scope !== actor.data_scope) go("/users", "error", "Account not found in your scope.");
  if (isSharedDemoIdentity(target)) go("/users", "error", SHARED_DEMO_ACCOUNT_NOTICE);
  if (target.email !== email) go("/users", "error", "The account changed. Reload before deleting it.");

  const admin = createAdminClient();
  // Admin reads avoid mistaking a record hidden by RLS for an unused account.
  const references = await Promise.all([
    admin.from("tools").select("id").eq("created_by", profileId).limit(1),
    admin.from("transactions").select("id").or(`borrower_id.eq.${profileId},processed_by.eq.${profileId}`).limit(1),
    admin.from("transaction_items").select("id").eq("returned_by", profileId).limit(1),
  ]);
  if (references.some(result => result.error)) go("/users", "error", "Account records could not be checked. No account was deleted. Try again.");
  if (references.some(result => result.data?.length)) go("/users", "error", "This user is linked to tools or borrowing and return history. Use Disable to remove access while keeping those records.");

  // Supabase refuses Auth deletion while the user owns Storage objects.
  // Collect every flat upload in this user's private photo folder first.
  const bucket = admin.storage.from("profile-photos");
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(profileId, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error || data?.some(file => !file.id)) go("/users", "error", "Profile photos could not be checked. No account was deleted. Try again.");
    for (const file of data ?? []) paths.push(`${profileId}/${file.name}`);
    if (!data || data.length < 100) break;
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await bucket.remove(paths.slice(offset, offset + 100));
    if (error) go("/users", "error", "Profile photos could not be removed. The account is still present. Try again.");
  }
  const { error } = await admin.auth.admin.deleteUser(profileId);
  // Database foreign keys and the last-custodian trigger remain the final guard
  // if a new reference or a concurrent account change occurs after the reads.
  if (error) go("/users", "error", "The account could not be deleted. Reload and check for linked records, or use Disable to remove access.");
  revalidatePath("/users"); revalidatePath("/dashboard");
  go("/users", "message", "User account permanently deleted.");
}

export async function createStudentAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    studentId: z.string().trim().min(2).max(40), yearSection: z.string().trim().min(2).max(60),
    program: z.string().trim().max(80), contactNumber: z.string().trim().min(7).max(30),
    temporaryPassword: z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
  }).safeParse({ fullName: value(formData, "full_name"), email: value(formData, "email"), studentId: value(formData, "student_id"), yearSection: value(formData, "year_section"), program: value(formData, "program"), contactNumber: value(formData, "contact_number"), temporaryPassword: value(formData, "temporary_password") });
  if (!parsed.success) go("/users", "error", "Complete the student details. The temporary password needs at least 10 characters, including a letter and a number.");
  if (await studentIdInUse(parsed.data.studentId)) go("/users", "error", "This Student ID already has an account. Use its existing account or reset its password.");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email, password: parsed.data.temporaryPassword, email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, student_id: parsed.data.studentId, year_section: parsed.data.yearSection, program: parsed.data.program, contact_number: parsed.data.contactNumber },
    app_metadata: { labtrack_data_scope: actor.data_scope, labtrack_managed_account: true },
  });
  if (error || !data.user) go("/users", "error", "The student account could not be created. Check whether this email is already registered.");
  const { error: profileError } = await admin.from("profiles").update({ full_name: parsed.data.fullName, student_id: parsed.data.studentId, year_section: parsed.data.yearSection, contact_number: parsed.data.contactNumber, role: "student", status: "active", data_scope: actor.data_scope, must_change_password: true }).eq("id", data.user.id);
  if (profileError) go("/users", "error", "The account was created, but its student profile needs attention. Contact the project owner before retrying.");
  revalidatePath("/users");
  go("/users", "message", "Student account created. Give the temporary password privately. The student signs in with Turnstile, chooses a private password, and can link a recovery authenticator from Profile.");
}

export async function resetPasswordAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ profileId: z.uuid(), temporaryPassword: z.string().min(10).max(128) }).safeParse({ profileId: value(formData, "profile_id"), temporaryPassword: value(formData, "temporary_password") });
  if (!parsed.success) go("/users", "error", "Temporary passwords must be at least 10 characters.");
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id,email,data_scope,updated_at").eq("id", parsed.data.profileId).maybeSingle();
  if (!target || target.data_scope !== actor.data_scope) go("/users", "error", "Account not found in your scope.");
  if (isSharedDemoIdentity(target)) go("/users", "error", SHARED_DEMO_ACCOUNT_NOTICE);
  const admin = createAdminClient();
  const result = await performPasswordUpdate(target, () => admin.auth.admin.updateUserById(parsed.data.profileId, { password: parsed.data.temporaryPassword }), true);
  if (!result.ok) go("/users", "error", result.message);
  revalidatePath("/users");
  go("/users", "message", "Temporary password set. The user must change it after sign-in.");
}

export async function deleteUnusedToolAction(formData: FormData) {
  await requireCustodian();
  const toolId = z.uuid().safeParse(value(formData, "tool_id"));
  if (!toolId.success) go("/tools", "error", "Invalid tool record.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_unused_tool", { p_tool_id: toolId.data });
  if (error) go("/tools", "error", "The change could not be completed. Check the details, reload the record, and try again.");
  revalidatePath("/tools"); revalidatePath("/dashboard");
  go("/tools", "message", "Unused tool record deleted.");
}

export async function assertProfileAccess() { return requireProfile(); }
