import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupabaseSecret } from "@/lib/server-env";

function limiterKey(value: string) {
  return createHmac("sha256", requireSupabaseSecret()).update(value).digest("hex");
}

export async function consumeLoginAttempt(email: string): Promise<boolean> {
  // HMAC keeps email addresses out of the limiter table, including predictable addresses.
  const key = limiterKey(`login:${email.trim().toLowerCase()}`);
  const { data, error } = await createAdminClient().rpc("consume_login_attempt", { p_key: key });
  if (error) throw new Error("Login protection is unavailable.");
  return data === true;
}

export async function consumePasswordResetAttempt(email: string, networkHint: string): Promise<boolean> {
  const admin = createAdminClient();
  // The email bucket always applies. The network bucket also limits attempts
  // across accounts; forwarded network hints are not trusted as identity proof.
  for (const input of [`password-reset:${email.trim().toLowerCase()}`, `password-reset-network:${networkHint.slice(0, 200)}`]) {
    const { data, error } = await admin.rpc("consume_login_attempt", { p_key: limiterKey(input) });
    if (error) throw new Error("Password reset protection unavailable.");
    if (data !== true) return false;
  }
  return true;
}

export async function consumeMfaAttempt(userId: string, purpose: "verify" | "manage" | "email-send" | "email-verify" = "verify"): Promise<boolean> {
  const key = limiterKey(`mfa:${purpose}:${userId}`);
  const { data, error } = await createAdminClient().rpc("consume_login_attempt", { p_key: key });
  if (error) throw new Error("Authenticator protection is unavailable.");
  return data === true;
}

export async function clearLoginAttempts(email: string): Promise<void> {
  const { error } = await createAdminClient().rpc("reset_login_attempts", {
    p_key: limiterKey(`login:${email.trim().toLowerCase()}`),
  });
  if (error) throw new Error("Login protection is unavailable.");
}

export async function clearMfaVerificationAttempts(userId: string): Promise<void> {
  // A successful code clears verification failures only; device management stays throttled.
  const { error } = await createAdminClient().rpc("reset_login_attempts", {
    p_key: limiterKey(`mfa:verify:${userId}`),
  });
  if (error) throw new Error("Authenticator protection is unavailable.");
}

export async function clearMfaManagementAttemptsAfterRecovery(userId: string): Promise<void> {
  // A consumed recovery code plus a fresh password permits immediate re-enrollment.
  const { error } = await createAdminClient().rpc("reset_login_attempts", { p_key: limiterKey(`mfa:manage:${userId}`) });
  if (error) throw new Error("Authenticator recovery is unavailable.");
}
