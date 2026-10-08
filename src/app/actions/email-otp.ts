"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeMfaAttempt } from "@/lib/login-limit";
import { EMAIL_OTP_SECONDS, secondFactorPath, sendEmailOtp, type EmailOtpState } from "@/lib/email-otp";
import { authCookieOptions, IDLE_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE, signSession } from "@/lib/session-policy";

async function identity() {
  await requireProfile(undefined, { allowPasswordChange: true, allowMfaSetup: true });
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (context.profile.data_scope === "demo" || context.aal === "aal2" || context.emailOtpVerified) {
    redirect(context.profile.must_change_password ? "/change-password" : "/dashboard");
  }
  return context;
}

export async function resendEmailOtpAction(): Promise<EmailOtpState> {
  const context = await identity();
  const supabase = await createClient();
  let path: string;
  try { path = await secondFactorPath(supabase); }
  catch { return { error: "Account verification is temporarily unavailable. Try again later." }; }
  if (path !== "/verify-email") redirect(path);
  return sendEmailOtp(supabase, context.profile.email, context.session);
}

export async function verifyEmailOtpAction(_previous: EmailOtpState, form: FormData): Promise<EmailOtpState> {
  const context = await identity();
  const code = String(form.get("code") ?? "").trim();
  if (!/^[0-9]{6}$/.test(code)) return { error: "Enter the six-digit code from your email." };
  const now = Math.floor(Date.now() / 1000);
  if (context.session.emailOtpSent === undefined || now - context.session.emailOtpSent >= EMAIL_OTP_SECONDS) {
    return { error: "Your code has expired. Request a new code and try again." };
  }
  const supabase = await createClient();
  let path: string;
  try { path = await secondFactorPath(supabase); }
  catch { return { error: "Account verification is temporarily unavailable. Try again later." }; }
  if (path !== "/verify-email") redirect(path);
  let providerSessionChanged = false;
  try {
    if (!await consumeMfaAttempt(context.profile.id, "email-verify")) return { error: "Too many verification attempts. Wait 15 minutes before trying again." };
    // The recipient comes only from the authenticated profile, never the form.
    const { data, error } = await supabase.auth.verifyOtp({ email: context.profile.email, token: code, type: "email" });
    if (error) return { error: "Code was not accepted. Use the latest email code and try again." };
    providerSessionChanged = true;
    const { data: verified, error: claimsError } = await supabase.auth.getClaims();
    const claims = verified?.claims;
    const remaining = context.session.started + MAX_SESSION_SECONDS - Math.floor(Date.now() / 1000);
    if (data.user?.id !== context.profile.id || claimsError || claims?.sub !== context.profile.id || typeof claims.session_id !== "string" || remaining <= 0) {
      throw new Error("Email verification did not establish the expected identity.");
    }
    // Email OTP stays AAL1 in Supabase. Record the app's password + inbox proof
    // for this specific provider session; never fake an AAL2 JWT or use metadata.
    const { error: grantError } = await createAdminClient().rpc("record_email_otp_verification", {
      p_user: context.profile.id, p_password_session: context.session.session, p_session: claims.session_id,
      p_expires_at: new Date((context.session.started + MAX_SESSION_SECONDS) * 1000).toISOString(),
    });
    if (grantError) throw new Error("Email verification could not be recorded.");
    (await cookies()).set(SESSION_COOKIE, signSession({ ...context.session, session: claims.session_id, seen: Math.floor(Date.now() / 1000) }), {
      ...authCookieOptions, maxAge: Math.min(IDLE_SECONDS, remaining),
    });
  } catch {
    if (providerSessionChanged) {
      (await cookies()).delete(SESSION_COOKIE);
      await supabase.auth.signOut({ scope: "local" });
      redirect("/login?error=Verification%20could%20not%20be%20completed.%20Please%20sign%20in%20again.");
    }
    return { error: "Email verification is temporarily unavailable. Try again later." };
  }
  revalidatePath("/", "layout");
  redirect(context.profile.must_change_password ? "/change-password" : "/dashboard");
}
