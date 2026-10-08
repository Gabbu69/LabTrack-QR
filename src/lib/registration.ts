import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationState = { error?: string; field?: string };
export const DUPLICATE_STUDENT_ID = "This Student ID already has an account. Sign in with your existing email, or ask the custodian to help recover your account.";

export async function studentIdInUse(studentId: string) {
  // Match IDs literally, including SQL wildcard characters; never disclose the email.
  const pattern = studentId.trim().replace(/[\\%_]/g, "\\$&");
  const { data, error } = await createAdminClient().from("profiles").select("id")
    .eq("data_scope", "operational").neq("status", "disabled")
    .ilike("student_id", pattern).limit(1).maybeSingle();
  if (error) throw new Error("Registration availability could not be checked.");
  return Boolean(data);
}
