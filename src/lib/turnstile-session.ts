import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_SESSION_SECONDS } from "@/lib/session-policy";

// Call only after server-side Turnstile validation AND password authentication.
export async function recordTurnstileSession(user: string, session: string, started: number) {
  const { error } = await createAdminClient().rpc("record_turnstile_verification", {
    p_user: user, p_session: session,
    p_expires_at: new Date((started + MAX_SESSION_SECONDS) * 1000).toISOString(),
  });
  if (error) throw new Error("Secure sign-in could not be established.");
}
