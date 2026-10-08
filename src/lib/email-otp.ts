import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { consumeMfaAttempt } from "@/lib/login-limit";
import { authCookieOptions, IDLE_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE, signSession, type Session } from "@/lib/session-policy";

export const EMAIL_OTP_SECONDS = 10 * 60;
export type EmailOtpState = { error?: string; message?: string };

// Enable only after the hosted migration, SMTP sender and inbox delivery pass.
// Keep authenticator enrollment available while email delivery is unconfigured.
export function isEmailOtpEnabled() {
  return process.env.EMAIL_OTP_ENABLED === "true";
}

export async function secondFactorPath(supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!isEmailOtpEnabled()) return "/two-factor";
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) throw new Error("Verification methods could not be loaded.");
  // Never downgrade an account that already enrolled a provider-managed factor.
  return data.all.some(factor => factor.status === "verified") ? "/two-factor" : "/verify-email";
}

export async function sendEmailOtp(supabase: Awaited<ReturnType<typeof createClient>>, email: string, session: Session): Promise<EmailOtpState> {
  const now = Math.floor(Date.now() / 1000);
  if (session.emailOtpSent !== undefined && now - session.emailOtpSent < 60) return { error: "Wait 60 seconds before requesting another code." };
  try {
    if (!await consumeMfaAttempt(session.user, "email-send")) return { error: "Too many code requests. Wait 15 minutes before trying again." };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return { error: "The email code could not be sent. Try again later or contact the laboratory custodian." };
    (await cookies()).set(SESSION_COOKIE, signSession({ ...session, seen: now, emailOtpSent: now }), {
      ...authCookieOptions, maxAge: Math.min(IDLE_SECONDS, session.started + MAX_SESSION_SECONDS - now),
    });
    return { message: "A verification code was sent to your email. Check your inbox and spam folder." };
  } catch { return { error: "Email verification is temporarily unavailable. Try again later." }; }
}
