import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// A database compare-and-set lease serializes Auth calls across server instances.
// No timeout steals a live lease. An interrupted process requires owner recovery.
export async function performPasswordUpdate(
  profile: { id: string; updated_at: string },
  updateAuth: () => Promise<{ error: unknown }>,
  requireChange: boolean,
) {
  const admin = createAdminClient();
  const operation = crypto.randomUUID();
  const { data: locked, error: lockError } = await admin.from("profiles")
    .update({ password_operation_id: operation, must_change_password: true })
    .eq("id", profile.id).eq("updated_at", profile.updated_at).is("password_operation_id", null).select("id").maybeSingle();
  if (lockError || !locked) return { ok: false, message: "Another account update is in progress. Reload and try again. If it persists, contact the deployment owner." };
  try {
    const { error } = await updateAuth();
    if (error) return { ok: false, message: "The password could not be changed. Try again." };
    const { data: finished, error: finishError } = await admin.from("profiles")
      .update({ must_change_password: requireChange, password_operation_id: null })
      .eq("id", profile.id).eq("password_operation_id", operation).select("id").maybeSingle();
    if (finishError || !finished) return { ok: false, message: "The password changed, but access remains restricted. Sign in with the new password and retry, or contact the deployment owner." };
    return { ok: true, message: "Password updated." };
  } catch {
    return { ok: false, message: "The password request was interrupted. Access remains restricted; try signing in again." };
  } finally {
    // Never clear the mandatory-change flag in a failure/cleanup path.
    await admin.from("profiles").update({ password_operation_id: null })
      .eq("id", profile.id).eq("password_operation_id", operation).select("id").maybeSingle();
  }
}
