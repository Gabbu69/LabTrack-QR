import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRecoveryCode, recoveryCodeHash, RECOVERY_METADATA_KEY } from "@/lib/mfa-recovery";

// Call only inside the existing per-user security lease after provider AAL2 proof.
// Only app_metadata is trusted; the user cannot edit it through updateUser.
export async function issueRecoveryCode(userId: string) {
  const code = createRecoveryCode();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    app_metadata: { [RECOVERY_METADATA_KEY]: { hash: recoveryCodeHash(userId, code), issued_at: new Date().toISOString() } },
  });
  if (error) throw new Error("Recovery code could not be saved.");
  return code;
}
