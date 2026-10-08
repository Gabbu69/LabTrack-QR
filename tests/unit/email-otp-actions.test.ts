import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { profile: { id: "user", email: "real@gmail.test", data_scope: "operational", must_change_password: false }, aal: "aal1", emailOtpVerified: false, session: { user: "user", session: "password-session", started: 100, seen: 200, emailOtpSent: 200 as number | undefined } },
  require: vi.fn(), consume: vi.fn(), verify: vi.fn(), claims: vi.fn(), grant: vi.fn(), set: vi.fn(), remove: vi.fn(), signOut: vi.fn(), send: vi.fn(), path: "/verify-email",
}));
vi.mock("@/lib/auth", () => ({ requireProfile: state.require, getAuthContext: async () => state.context }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.set, delete: state.remove }) }));
vi.mock("@/lib/session-policy", () => ({ SESSION_COOKIE: "labtrack-session", MAX_SESSION_SECONDS: 28800, IDLE_SECONDS: 1800, authCookieOptions: { httpOnly: true }, signSession: (value: unknown) => value }));
vi.mock("@/lib/login-limit", () => ({ consumeMfaAttempt: state.consume }));
vi.mock("@/lib/email-otp", () => ({ EMAIL_OTP_SECONDS: 600, secondFactorPath: async () => state.path, sendEmailOtp: state.send }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: state.verify, getClaims: state.claims, signOut: state.signOut } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.grant }) }));
import { resendEmailOtpAction, verifyEmailOtpAction } from "@/app/actions/email-otp";

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(300_000);
  state.context = { profile: { id: "user", email: "real@gmail.test", data_scope: "operational", must_change_password: false }, aal: "aal1", emailOtpVerified: false, session: { user: "user", session: "password-session", started: 100, seen: 200, emailOtpSent: 200 } };
  state.path = "/verify-email";
  state.require.mockResolvedValue(state.context.profile);
  state.consume.mockResolvedValue(true);
  state.verify.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  state.claims.mockResolvedValue({ data: { claims: { sub: "user", session_id: "email-session", aal: "aal1" } }, error: null });
  state.grant.mockResolvedValue({ error: null });
  state.send.mockResolvedValue({ message: "Sent." });
  state.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());
function form(code = "123456") { const data = new FormData(); data.set("code", code); data.set("email", "attacker@example.test"); return data; }

it("verifies only the password-authenticated account's email and binds proof to the new provider session", async () => {
  await expect(verifyEmailOtpAction({}, form())).rejects.toThrow("REDIRECT:/dashboard");
  expect(state.verify).toHaveBeenCalledWith({ email: "real@gmail.test", token: "123456", type: "email" });
  expect(state.grant).toHaveBeenCalledWith("record_email_otp_verification", { p_user: "user", p_password_session: "password-session", p_session: "email-session", p_expires_at: new Date(28_900_000).toISOString() });
  expect(state.set).toHaveBeenCalledWith("labtrack-session", expect.objectContaining({ user: "user", session: "email-session", started: 100, seen: 300 }), expect.objectContaining({ httpOnly: true }));
  expect(state.consume).toHaveBeenCalledWith("user", "email-verify");
});
it.each(["12345", "1234567", "abcdef", ""])("rejects malformed email code %s before calling Auth", async code => {
  expect((await verifyEmailOtpAction({}, form(code))).error).toMatch(/six-digit/);
  expect(state.verify).not.toHaveBeenCalled(); expect(state.grant).not.toHaveBeenCalled();
});
it.each([undefined, -300])("rejects missing or expired delivery proof %s", async sent => {
  state.context.session.emailOtpSent = sent;
  expect((await verifyEmailOtpAction({}, form())).error).toMatch(/expired/);
  expect(state.verify).not.toHaveBeenCalled(); expect(state.grant).not.toHaveBeenCalled();
});
it("does not grant access for wrong or reused codes", async () => {
  state.verify.mockResolvedValue({ data: {}, error: { message: "private" } });
  expect((await verifyEmailOtpAction({}, form())).error).toMatch(/not accepted/);
  expect(state.grant).not.toHaveBeenCalled(); expect(state.set).not.toHaveBeenCalled();
});
it("blocks repeated guesses without consuming email-delivery limits", async () => {
  state.consume.mockResolvedValue(false);
  expect((await verifyEmailOtpAction({}, form())).error).toMatch(/15 minutes/);
  expect(state.verify).not.toHaveBeenCalled();
});
it("retains the authenticator requirement for an already enrolled account", async () => {
  state.path = "/two-factor";
  await expect(verifyEmailOtpAction({}, form())).rejects.toThrow("REDIRECT:/two-factor");
  await expect(resendEmailOtpAction()).rejects.toThrow("REDIRECT:/two-factor");
  expect(state.verify).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
});
it.each(["other-user", "claims-error", "grant-error"])("clears the changed provider session and fails closed: %s", async mode => {
  if (mode === "other-user") state.verify.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
  if (mode === "claims-error") state.claims.mockResolvedValue({ data: null, error: {} });
  if (mode === "grant-error") state.grant.mockResolvedValue({ error: {} });
  await expect(verifyEmailOtpAction({}, form())).rejects.toThrow("REDIRECT:/login?error=");
  expect(state.remove).toHaveBeenCalledWith("labtrack-session");
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(state.set).not.toHaveBeenCalled();
});
it("still requires a private password after email verification when applicable", async () => {
  state.context.profile.must_change_password = true;
  await expect(verifyEmailOtpAction({}, form())).rejects.toThrow("REDIRECT:/change-password");
});
it("resends only to the authenticated account", async () => {
  expect(await resendEmailOtpAction()).toEqual({ message: "Sent." });
  expect(state.send).toHaveBeenCalledWith(expect.anything(), "real@gmail.test", state.context.session);
});
it("does not let a disabled account reach either action", async () => {
  state.require.mockRejectedValue(new Error("REDIRECT:/login?error=Disabled"));
  await expect(verifyEmailOtpAction({}, form())).rejects.toThrow("Disabled");
  await expect(resendEmailOtpAction()).rejects.toThrow("Disabled");
  expect(state.verify).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
});
