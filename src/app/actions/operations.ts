"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCustodian, requireProfile } from "@/lib/auth";
import { normalizeAssetPrefix } from "@/lib/asset-code";
import { toolBatchSchema } from "@/lib/validation";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function go(path: string, key: "error" | "message", message: string): never { redirect(`${path}?${key}=${encodeURIComponent(message)}`); }

export async function createToolBatchAction(formData: FormData) {
  await requireCustodian();
  const parsed = toolBatchSchema.safeParse({ toolName: value(formData, "tool_name"), description: value(formData, "description"), category: value(formData, "category"), quantity: value(formData, "quantity"), codePrefix: value(formData, "code_prefix"), condition: value(formData, "condition") });
  if (!parsed.success) go("/tools", "error", parsed.error.issues[0]?.message ?? "Check the tool details.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tool_batch", { p_tool_name: parsed.data.toolName, p_description: parsed.data.description, p_category: parsed.data.category, p_quantity: parsed.data.quantity, p_code_prefix: normalizeAssetPrefix(parsed.data.codePrefix), p_condition: parsed.data.condition });
  if (error) go("/tools", "error", error.message);
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
  if (error) go(`/tools/${parsed.data.toolId}`, "error", error.message);
  revalidatePath("/tools"); revalidatePath(`/tools/${parsed.data.toolId}`); revalidatePath("/dashboard");
  go(`/tools/${parsed.data.toolId}`, "message", "Tool record updated.");
}

export async function setProfileStatusAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ profileId: z.uuid(), status: z.enum(["pending", "active", "disabled"]) }).safeParse({ profileId: value(formData, "profile_id"), status: value(formData, "status") });
  if (!parsed.success) go("/users", "error", "Invalid account update.");
  if (parsed.data.profileId === actor.id && parsed.data.status !== "active") go("/users", "error", "You cannot deactivate your current account.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profile_status", { p_profile_id: parsed.data.profileId, p_status: parsed.data.status });
  if (error) go("/users", "error", error.message);
  revalidatePath("/users");
  go("/users", "message", "Account status updated.");
}

export async function createStaffAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ fullName: z.string().trim().min(2).max(120), email: z.email().trim().toLowerCase(), role: z.enum(["custodian", "instructor"]), temporaryPassword: z.string().min(10) }).safeParse({ fullName: value(formData, "full_name"), email: value(formData, "email"), role: value(formData, "role"), temporaryPassword: value(formData, "temporary_password") });
  if (!parsed.success) go("/users", "error", parsed.error.issues[0]?.message ?? "Check the staff account details.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.temporaryPassword, email_confirm: true, user_metadata: { full_name: parsed.data.fullName }, app_metadata: { labtrack_staff_role: parsed.data.role, labtrack_data_scope: actor.data_scope } });
  if (error) go("/users", "error", error.message);
  revalidatePath("/users");
  go("/users", "message", "Staff account created. Give the temporary password directly to the staff member.");
}

export async function resetPasswordAction(formData: FormData) {
  const actor = await requireCustodian();
  const parsed = z.object({ profileId: z.uuid(), temporaryPassword: z.string().min(10) }).safeParse({ profileId: value(formData, "profile_id"), temporaryPassword: value(formData, "temporary_password") });
  if (!parsed.success) go("/users", "error", "Temporary passwords must be at least 10 characters.");
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id,data_scope").eq("id", parsed.data.profileId).maybeSingle();
  if (!target || target.data_scope !== actor.data_scope) go("/users", "error", "Account not found in your scope.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.profileId, { password: parsed.data.temporaryPassword });
  if (error) go("/users", "error", error.message);
  await admin.from("profiles").update({ must_change_password: true }).eq("id", parsed.data.profileId);
  go("/users", "message", "Temporary password set. The user must change it after sign-in.");
}

export async function deleteUnusedToolAction(formData: FormData) {
  await requireCustodian();
  const toolId = z.uuid().safeParse(value(formData, "tool_id"));
  if (!toolId.success) go("/tools", "error", "Invalid tool record.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_unused_tool", { p_tool_id: toolId.data });
  if (error) go("/tools", "error", error.message);
  revalidatePath("/tools"); revalidatePath("/dashboard");
  go("/tools", "message", "Unused tool record deleted.");
}

export async function assertProfileAccess() { return requireProfile(); }
