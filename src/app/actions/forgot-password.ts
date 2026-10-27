"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation";
import { clearLoginAttempts, consumePasswordResetAttempt } from "@/lib/login-limit";
import { resetPasswordWithAuthenticator, type ForgotPasswordState } from "@/lib/forgot-password";
import { SESSION_COOKIE } from "@/lib/session-policy";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

const inputSchema = passwordSchema.and(z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), code: z.string().trim().regex(/^[0-9]{6}$/) }));

export async function forgotPasswordAction(_previous: ForgotPasswordState, form: FormData): Promise<ForgotPasswordState> {
  void _previous;
  const input = inputSchema.safeParse(Object.fromEntries(["email", "code", "password", "confirmation"].map(key => [key, String(form.get(key) ?? "")])));
  if (!input.success) return { error: "Check the email, six-digit code, and matching passwords. Use 10+ characters with a letter and number." };
  try {
    const requestHeaders = await headers();
    const network = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!await consumePasswordResetAttempt(input.data.email, network)) return { error: "Too many reset attempts. Wait 15 minutes and try again." };
    if (!await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), "password_reset")) return { error: TURNSTILE_ERROR };
    const result = await resetPasswordWithAuthenticator(input.data.email, input.data.code, input.data.password);
    if (!result.ok) return { error: result.error };
  } catch { return { error: "Password reset is temporarily unavailable. Try again later." }; }
  let message = "Password reset. Sign in with your new password.";
  try { await clearLoginAttempts(input.data.email); }
  catch { message = "Password reset. If sign-in is limited, wait 15 minutes and try your new password."; }
  (await cookies()).delete(SESSION_COOKIE);
  redirect(`/login?message=${encodeURIComponent(message)}`);
}
