import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MfaActionState } from "@/lib/mfa";

// Provider calls cannot share a PostgreSQL transaction. A server-only lease
// keeps factor listing and mutation exclusive across tabs and server instances.
// A killed process leaves its lease for verified owner recovery; no timer steals it.
export async function serializeMfaOperation(userId: string, mutation: () => Promise<MfaActionState>, options: { requirePrivatePassword?: boolean } = {}): Promise<MfaActionState> {
  const admin = createAdminClient();
  const operation = crypto.randomUUID();
  let query = admin.from("profiles")
    .update({ mfa_operation_id: operation }).eq("id", userId)
    .eq("data_scope", "operational").neq("status", "disabled")
    .is("mfa_operation_id", null);
  if (options.requirePrivatePassword) query = query.eq("must_change_password", false);
  const { data: locked, error: lockError } = await query.select("id").maybeSingle();
  if (lockError) return { error: "Authenticator management is temporarily unavailable. Try again later." };
  if (!locked) return { error: "Another authenticator update is in progress. Reload and try again. If it persists, contact the deployment owner." };
  try {
    return await mutation();
  } finally {
    const { error } = await admin.from("profiles").update({ mfa_operation_id: null })
      .eq("id", userId).eq("mfa_operation_id", operation).select("id").maybeSingle();
    if (error) throw new Error("Authenticator operation could not be released.");
  }
}
