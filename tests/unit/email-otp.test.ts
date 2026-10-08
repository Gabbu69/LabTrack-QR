import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ allowed: true, set: vi.fn(), consume: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock("@/lib/login-limit", () => ({ consumeMfaAttempt: state.consume }));
import { secondFactorPath, sendEmailOtp } from "@/lib/email-otp";
import { readSession } from "@/lib/session-policy";
import type { createClient } from "@/lib/supabase/server";

const session = { user: "user", session: "session", started: 100, seen: 100 };
function client(factors: { status: string }[] = [], error: object | null = null) {
  return { auth: { mfa: { listFactors: vi.fn().mockResolvedValue({ data: { all: factors }, error }) }, signInWithOtp: vi.fn().mockResolvedValue({ error }) } } as unknown as Awaited<ReturnType<typeof createClient>>;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(200_000);
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret"); state.consume.mockResolvedValue(true);
  vi.stubEnv("EMAIL_OTP_ENABLED", "true");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("keeps authenticator sign-in and enrollment available until email delivery is enabled", async () => {
  vi.stubEnv("EMAIL_OTP_ENABLED", "false");
  const supabase = client();
  expect(await secondFactorPath(supabase)).toBe("/two-factor");
  expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  vi.stubEnv("EMAIL_OTP_ENABLED", "");
  expect(await secondFactorPath(supabase)).toBe("/two-factor");
});

it("uses email for new accounts and keeps every verified provider factor on the existing flow", async () => {
  expect(await secondFactorPath(client())).toBe("/verify-email");
  expect(await secondFactorPath(client([{ status: "unverified" }]))).toBe("/verify-email");
  expect(await secondFactorPath(client([{ status: "verified" }]))).toBe("/two-factor");
  await expect(secondFactorPath(client([], {}))).rejects.toThrow("Verification methods");
});
it("sends only to an existing account and signs the pending timestamp without granting access", async () => {
  const supabase = client();
  expect((await sendEmailOtp(supabase, "student@example.test", session)).message).toMatch(/sent/);
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "student@example.test", options: { shouldCreateUser: false } });
  const token = state.set.mock.calls[0][1] as string;
  expect(readSession(token, "user", "session", 200)).toEqual({ ...session, seen: 200, emailOtpSent: 200 });
  expect(state.consume).toHaveBeenCalledWith("user", "email-send");
});
it("enforces resend cooldown and server-side delivery limits", async () => {
  const supabase = client();
  expect((await sendEmailOtp(supabase, "student@example.test", { ...session, emailOtpSent: 150 })).error).toMatch(/60 seconds/);
  expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  state.consume.mockResolvedValue(false);
  expect((await sendEmailOtp(supabase, "student@example.test", session)).error).toMatch(/15 minutes/);
  expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
});
it("does not mark a code as sent or expose provider errors when delivery fails", async () => {
  expect((await sendEmailOtp(client([], { message: "secret provider detail" }), "student@example.test", session)).error).toMatch(/could not be sent/);
  expect(state.set).not.toHaveBeenCalled();
});
