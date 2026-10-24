"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clearMfaManagementAttemptsAfterRecovery, clearMfaVerificationAttempts, consumeMfaAttempt } from "@/lib/login-limit";
import { mfaCodeSchema, mfaNameSchema } from "@/lib/validation";
import type { MfaActionState } from "@/lib/mfa";
import { serializeMfaOperation } from "@/lib/mfa-operation";
import { authCookieOptions, IDLE_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE, signSession } from "@/lib/session-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueRecoveryCode } from "@/lib/mfa-recovery-store";
import { matchesRecoveryCode, RECOVERY_METADATA_KEY } from "@/lib/mfa-recovery";
import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";

function value(form: FormData, key: string) { return String(form.get(key) ?? ""); }

async function identity() {
  await requireProfile(undefined, { allowPasswordChange: true, allowMfaSetup: true });
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

async function limit(userId: string, purpose: "verify" | "manage"): Promise<MfaActionState | null> {
  try {
    if (!await consumeMfaAttempt(userId, purpose)) return { error: "Too many authenticator attempts. Wait 15 minutes before trying again." };
  } catch { return { error: "Authenticator verification is temporarily unavailable. Try again later." }; }
  return null;
}

async function persistVerifiedSession(supabase: Awaited<ReturnType<typeof createClient>>, context: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>, clearVerification = false) {
  // Verification changes the provider token. Do not reuse the cached AAL1 identity.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const now = Math.floor(Date.now() / 1000);
  const remaining = MAX_SESSION_SECONDS - (now - context.session.started);
  if (error || claims?.sub !== context.profile.id || claims?.aal !== "aal2" || typeof claims.session_id !== "string" || remaining <= 0) return false;
  if (clearVerification) await clearMfaVerificationAttempts(context.profile.id);
  (await cookies()).set(SESSION_COOKIE, signSession({ user: context.profile.id, session: claims.session_id, started: context.session.started, seen: now }), {
    ...authCookieOptions, maxAge: Math.min(IDLE_SECONDS, remaining),
  });
  return true;
}

export async function enrollMfaAction(_previous: MfaActionState, form: FormData): Promise<MfaActionState> {
  const context = await identity();
  if (context.profile.data_scope === "demo") return { error: "Shared demo accounts cannot enroll personal authenticators." };
  const name = mfaNameSchema.safeParse(value(form, "friendly_name"));
  if (!name.success) return { error: "Use an authenticator name of at most 60 characters." };
  const blocked = await limit(context.profile.id, "manage");
  if (blocked) return blocked;
  try {
    return await serializeMfaOperation(context.profile.id, async () => {
      const supabase = await createClient();
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error || !factors) return { error: "Authenticators could not be loaded. Try again." };
      if (factors.all.some(factor => factor.status === "verified") && context.aal !== "aal2") return { error: "Verify your existing authenticator before adding another device." };
      // Abandoned setup attempts are not active factors; clear only this user's pending TOTP entries.
      for (const factor of factors.all.filter(factor => factor.factor_type === "totp" && factor.status === "unverified")) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (cleanupError) return { error: "An earlier setup could not be cleared. Try again." };
      }
      const { data, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp", issuer: "LabTrack QR", friendlyName: name.data || `Authenticator ${crypto.randomUUID().slice(0, 8)}`,
      });
      if (enrollmentError || !data) return { error: "Setup could not be started. Use a different device name or try again." };
      return { enrollment: { factorId: data.id, uri: data.totp.uri, secret: data.totp.secret } };
    });
  } catch { return { error: "Authenticator setup is temporarily unavailable. Try again later." }; }
}

export async function verifyMfaAction(_previous: MfaActionState, form: FormData): Promise<MfaActionState> {
  const context = await identity();
  if (context.profile.data_scope === "demo") return { error: "Shared demo accounts do not use personal authenticators." };
  const parsed = mfaCodeSchema.safeParse({ factorId: value(form, "factor_id"), code: value(form, "code") });
  if (!parsed.success) return { error: "Enter a valid authenticator and its six-digit code." };
  const blocked = await limit(context.profile.id, "verify");
  if (blocked) return blocked;
  let saveRecovery = false;
  try {
    const result = await serializeMfaOperation(context.profile.id, async () => {
      const supabase = await createClient();
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error || !factors) return { error: "Authenticators could not be loaded. Try again." };
      const factor = factors.all.find(item => item.id === parsed.data.factorId && item.factor_type === "totp");
      if (!factor || (factor.status !== "verified" && factors.all.some(item => item.status === "verified") && context.aal !== "aal2")) {
        return { error: "Verify an active authenticator linked to your account." };
      }
      const { error: verificationError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
      if (verificationError) return { error: "Code was not accepted. Use the current code and try again." };
      if (!await persistVerifiedSession(supabase, context, true)) return { error: "Verification could not establish a secure session. Sign out and try again." };
      if (factor.status === "unverified" && !factors.all.some(item => item.status === "verified")) {
        return { message: "SAVE_RECOVERY_CODE" };
      }
      return {};
    });
    if (result.error) return result;
    saveRecovery = result.message === "SAVE_RECOVERY_CODE";
  } catch { return { error: "Authenticator verification is temporarily unavailable. Try again later." }; }
  revalidatePath("/", "layout");
  if (saveRecovery) redirect("/recovery-code");
  redirect(context.profile.must_change_password ? "/change-password" : value(form, "manage") === "1" ? "/two-factor?manage=1&message=Authenticator%20added." : "/dashboard");
}

export async function generateRecoveryCodeAction(_previous: MfaActionState): Promise<MfaActionState> {
  void _previous;
  const context = await identity();
  if (context.profile.data_scope === "demo" || context.aal !== "aal2") return { error: "Verify your authenticator before creating a recovery code." };
  const blocked = await limit(context.profile.id, "manage");
  if (blocked) return blocked;
  try {
    return await serializeMfaOperation(context.profile.id, async () => ({ recoveryCode: await issueRecoveryCode(context.profile.id) }), { requirePrivatePassword: !context.profile.must_change_password });
  } catch { return { error: "Recovery code could not be created. Try again." }; }
}

export async function recoverMfaAction(_previous: MfaActionState, form: FormData): Promise<MfaActionState> {
  const context = await identity();
  if (context.profile.data_scope === "demo" || context.aal === "aal2") return { error: "Use authenticator settings to manage this account." };
  const blocked = await limit(context.profile.id, "verify");
  if (blocked) return blocked;
  try {
    const result = await serializeMfaOperation(context.profile.id, async () => {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.getUserById(context.profile.id);
      const recovery = data?.user?.app_metadata?.[RECOVERY_METADATA_KEY];
      if (error || !matchesRecoveryCode(context.profile.id, value(form, "recovery_code"), recovery?.hash)) return { error: "Recovery code is incorrect or already used." };
      const env = requireSupabaseEnv();
      const passwordClient = createIsolatedClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: passwordProof, error: passwordError } = await passwordClient.auth.signInWithPassword({ email: context.profile.email, password: value(form, "password") });
      await passwordClient.auth.signOut({ scope: "local" });
      if (passwordError || passwordProof.user?.id !== context.profile.id) return { error: "Password is incorrect." };
      // Consume before modifying provider factors. A crash fails closed; the code
      // is never restored after partial recovery. The lease prevents double use.
      const { error: consumeError } = await admin.auth.admin.updateUserById(context.profile.id, { app_metadata: { [RECOVERY_METADATA_KEY]: null } });
      if (consumeError) return { error: "Recovery is unavailable. Try again later." };
      const { data: factors, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId: context.profile.id });
      if (factorsError || !factors) return { error: "Recovery could not finish. Ask the custodian for help." };
      for (const factor of factors.factors) {
        const { error: removalError } = await admin.auth.admin.mfa.deleteFactor({ userId: context.profile.id, id: factor.id });
        if (removalError) return { error: "Recovery could not finish. Ask the custodian for help." };
      }
      await clearMfaManagementAttemptsAfterRecovery(context.profile.id);
      return { message: "Recovered" };
    });
    if (result.error) return result;
  } catch { return { error: "Recovery is temporarily unavailable. Try again later." }; }
  // A recovery code permits replacement only, never AAL2 or portal access.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  (await cookies()).delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login?message=Recovery%20code%20used.%20Sign%20in%20and%20link%20a%20new%20authenticator.");
}

export async function removeMfaAction(_previous: MfaActionState, form: FormData): Promise<MfaActionState> {
  const context = await identity();
  if (context.profile.data_scope === "demo" || context.aal !== "aal2" || context.profile.must_change_password) return { error: "Verify your account before managing authenticators." };
  const parsed = z.uuid().safeParse(value(form, "factor_id"));
  if (!parsed.success) return { error: "Choose a valid authenticator." };
  const blocked = await limit(context.profile.id, "manage");
  if (blocked) return blocked;
  let sessionReady = false;
  let removed = false;
  try {
    const result = await serializeMfaOperation(context.profile.id, async () => {
      const supabase = await createClient();
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error || !factors) return { error: "Authenticators could not be loaded. Try again." };
      if (!factors.totp.some(factor => factor.id === parsed.data)) return { error: "Choose an authenticator linked to your account." };
      if (factors.totp.length < 2) return { error: "Add and verify a backup authenticator before removing your last device." };
      const { error: removalError } = await supabase.auth.mfa.unenroll({ factorId: parsed.data });
      if (removalError) return { error: "The authenticator could not be removed. Try again." };
      removed = true;
      const { error: refreshError } = await supabase.auth.refreshSession();
      sessionReady = !refreshError && await persistVerifiedSession(supabase, context);
      return {};
    }, { requirePrivatePassword: true });
    if (result.error) return result;
  } catch {
    if (!removed) return { error: "Authenticator management is temporarily unavailable. Try again later." };
  }
  revalidatePath("/", "layout");
  if (!sessionReady) {
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/login?message=Authenticator%20removed.%20Sign%20in%20again.");
  }
  redirect("/two-factor?manage=1&message=Authenticator%20removed.");
}
