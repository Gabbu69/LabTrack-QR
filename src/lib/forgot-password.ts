import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupabaseEnv } from "@/lib/env";
import { requireSupabaseSecret } from "@/lib/server-env";
import { serializeMfaOperation } from "@/lib/mfa-operation";
import { performPasswordUpdate } from "@/lib/password-operation";
import { clearMfaVerificationAttempts } from "@/lib/login-limit";
import { PASSWORD_RESET_PROOFS, recentResetProofs, resetProof, resetProofUsed } from "@/lib/password-reset-proof";

export const RESET_DENIED = "Check your email and authenticator code, or ask the custodian for help.";
export type ForgotPasswordState = { error?: string };

export async function resetPasswordWithAuthenticator(email: string, code: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const denied = { ok: false, error: RESET_DENIED };
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("id,status,data_scope,email,updated_at").eq("email", email).maybeSingle();
  if (error) throw new Error("Account lookup unavailable.");
  if (!profile || profile.status === "disabled" || profile.data_scope !== "operational") return denied;
  const result = await serializeMfaOperation(profile.id, async () => {
    const { data: account, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || account.user.email?.toLowerCase() !== email) return { error: RESET_DENIED };
    const now = Math.floor(Date.now() / 1000);
    const proof = resetProof(profile.id, code, requireSupabaseSecret());
    const recent = recentResetProofs(account.user.app_metadata?.[PASSWORD_RESET_PROOFS], now);
    if (resetProofUsed(recent, proof)) return { error: RESET_DENIED };
    const { data: owned, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId: profile.id });
    if (factorsError || !owned || !Array.isArray(owned.factors)) return { error: RESET_DENIED };
    const factors = owned.factors.filter(factor => factor.factor_type === "totp" && factor.status === "verified");
    if (!factors.length || factors.length > 10) return { error: RESET_DENIED };
    const env = requireSupabaseEnv();
    // The provider requires a session to challenge TOTP. This short-lived,
    // server-only recovery session is never put in cookies or returned to a user.
    // Recovery links do not create accounts or send messages through this API.
    const isolated = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    let changed = false;
    try {
      const { data: generated, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email });
      if (linkError || generated.user?.id !== profile.id || !generated.properties?.hashed_token) return { error: RESET_DENIED };
      const { data: session, error: sessionError } = await isolated.auth.verifyOtp({ token_hash: generated.properties.hashed_token, type: "recovery" });
      if (sessionError || session.user?.id !== profile.id) return { error: RESET_DENIED };
      let verified = false;
      for (const factor of factors) {
        const verification = await isolated.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
        if (!verification.error) { verified = true; break; }
      }
      if (!verified) return { error: RESET_DENIED };
      const { data: claims, error: claimsError } = await isolated.auth.getClaims();
      if (claimsError || claims?.claims?.sub !== profile.id || claims.claims.aal !== "aal2") return { error: RESET_DENIED };
      // Consume this proof before any password mutation. A retry needs a new OTP.
      const { error: proofError } = await admin.auth.admin.updateUserById(profile.id, { app_metadata: { [PASSWORD_RESET_PROOFS]: [...recent, { proof, expires: now + 180 }] } });
      if (proofError) return { error: "Password reset is temporarily unavailable. Try again later." };
      // The MFA lease updates the profile timestamp, so reload before the
      // password operation's compare-and-set. A concurrent disable fails closed.
      const { data: fresh, error: freshError } = await admin.from("profiles").select("id,status,data_scope,updated_at").eq("id", profile.id).maybeSingle();
      if (freshError || !fresh || fresh.status === "disabled" || fresh.data_scope !== "operational") return { error: RESET_DENIED };
      await clearMfaVerificationAttempts(profile.id);
      const update = await performPasswordUpdate(fresh, () => isolated.auth.updateUser({ password }), false);
      if (!update.ok) return { error: "Password could not be reset. Use a new authenticator code and try again." };
      changed = true;
      return { message: "PASSWORD_RESET" };
    } finally {
      await isolated.auth.signOut({ scope: changed ? "global" : "local" });
    }
  });
  return result.message === "PASSWORD_RESET" ? { ok: true } : { ok: false, error: result.error ?? RESET_DENIED };
}
