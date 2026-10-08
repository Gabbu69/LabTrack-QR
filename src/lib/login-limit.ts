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
