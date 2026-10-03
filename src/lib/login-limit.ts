import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupabaseSecret } from "@/lib/server-env";

export async function consumeLoginAttempt(email: string): Promise<boolean> {
  // HMAC keeps email addresses out of the limiter table, including predictable addresses.
  const key = createHmac("sha256", requireSupabaseSecret()).update(`login:${email.trim().toLowerCase()}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("consume_login_attempt", { p_key: key });
  if (error) throw new Error("Login protection is unavailable.");
  return data === true;
}

export async function consumeMfaAttempt(userId: string, purpose: "verify" | "manage" = "verify"): Promise<boolean> {
  const key = createHmac("sha256", requireSupabaseSecret()).update(`mfa:${purpose}:${userId}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("consume_login_attempt", { p_key: key });
  if (error) throw new Error("Authenticator protection is unavailable.");
  return data === true;
}
