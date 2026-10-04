"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clearMfaVerificationAttempts, consumeMfaAttempt } from "@/lib/login-limit";
import { mfaCodeSchema, mfaNameSchema } from "@/lib/validation";
import type { MfaActionState } from "@/lib/mfa";
import { authCookieOptions, IDLE_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE, signSession } from "@/lib/session-policy";

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
  } catch { return { error: "Authenticator setup is temporarily unavailable. Try again later." }; }
}

export async function verifyMfaAction(_previous: MfaActionState, form: FormData): Promise<MfaActionState> {
  const context = await identity();
  if (context.profile.data_scope === "demo") return { error: "Shared demo accounts do not use personal authenticators." };
  const parsed = mfaCodeSchema.safeParse({ factorId: value(form, "factor_id"), code: value(form, "code") });
  if (!parsed.success) return { error: "Enter a valid authenticator and its six-digit code." };
  const blocked = await limit(context.profile.id, "verify");
  if (blocked) return blocked;
  try {
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
  } catch { return { error: "Authenticator verification is temporarily unavailable. Try again later." }; }
  revalidatePath("/", "layout");
  redirect(context.profile.must_change_password ? "/change-password" : value(form, "manage") === "1" ? "/two-factor?manage=1&message=Authenticator%20added." : "/dashboard");
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
