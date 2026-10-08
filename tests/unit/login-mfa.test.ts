import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: { status: "active", data_scope: "operational", must_change_password: false },
  claims: { sub: "user", session_id: "session", aal: "aal1" },
  claimsError: false, signOut: vi.fn(), set: vi.fn(), allowed: true, passwordError: false,
  attempts: 0, clear: vi.fn(),
  factorPath: "/two-factor", send: vi.fn(), signup: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/email-otp", () => ({ secondFactorPath: async () => state.factorPath, sendEmailOtp: state.send }));
vi.mock("@/lib/login-limit", () => ({
  consumeLoginAttempt: async () => state.allowed && ++state.attempts <= 5,
  clearLoginAttempts: (email: string) => state.clear(email),
}));
vi.mock("@/lib/session-policy", () => ({ authCookieOptions: { httpOnly: true }, IDLE_SECONDS: 1800, SESSION_COOKIE: "labtrack-session", signSession: () => "signed-pending-session" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: {
    signUp: state.signup,
    signInWithPassword: async () => ({ data: { user: { id: "user" } }, error: state.passwordError ? { code: "bad_password" } : null }),
    getClaims: async () => ({ data: { claims: state.claims }, error: state.claimsError ? {} : null }), signOut: state.signOut,
  },
  from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: state.profile }) }; return query; },
}) }));
import { loginAction, registerAction } from "@/app/actions/auth";

beforeEach(() => {
  vi.clearAllMocks(); state.profile = { status: "active", data_scope: "operational", must_change_password: false };
  state.claims = { sub: "user", session_id: "session", aal: "aal1" }; state.claimsError = false; state.allowed = true; state.passwordError = false;
  state.attempts = 0; state.clear.mockReset().mockImplementation(async () => { state.attempts = 0; });
  state.factorPath = "/two-factor"; state.send.mockResolvedValue({ message: "Code sent." });
  state.signup.mockResolvedValue({ data: { session: { access_token: "fixture" } }, error: null });
});
function form() { const data = new FormData(); data.set("email", "student@school.test"); data.set("password", "test-password"); return data; }
function registration() {
  const data = form();
  for (const [name, value] of Object.entries({ full_name: "New Student", student_id: "STUDENT-1", year_section: "2nd Year", group_number: "3", contact_number: "09123456789" })) data.set(name, value);
  return data;
}

it("takes a newly registered, provider-confirmed student straight to email verification", async () => {
  state.factorPath = "/verify-email"; state.profile.status = "pending";
  await expect(registerAction(registration())).rejects.toThrow("REDIRECT:/verify-email?message=");
  expect(state.signup).toHaveBeenCalledWith(expect.objectContaining({ email: "student@school.test" }));
  expect(state.send).toHaveBeenCalledOnce();
});
it("preserves provider confirmation requirements when signup returns no session", async () => {
  state.signup.mockResolvedValue({ data: { session: null }, error: null });
  await expect(registerAction(registration())).rejects.toThrow("REDIRECT:/login?message=Registration%20received.%20Check%20your%20inbox");
  expect(state.send).not.toHaveBeenCalled();
});

it("directs password-only real accounts to MFA, not the portal", async () => {
  await expect(loginAction(form())).rejects.toThrow("REDIRECT:/two-factor");
  expect(state.set).toHaveBeenCalledWith("labtrack-session", "signed-pending-session", expect.objectContaining({ httpOnly: true, maxAge: 1800 }));
});
it("requires MFA before changing a real account's temporary password", async () => {
  state.profile.must_change_password = true;
  await expect(loginAction(form())).rejects.toThrow("REDIRECT:/two-factor");
});
it("sends an inbox code after password verification for a new personal account", async () => {
  state.factorPath = "/verify-email";
  await expect(loginAction(form())).rejects.toThrow("REDIRECT:/verify-email?message=Code%20sent.");
  expect(state.send).toHaveBeenCalledWith(expect.anything(), "student@school.test", expect.objectContaining({ user: "user", session: "session" }));
});
it("keeps a new account outside the portal when email delivery fails", async () => {
  state.factorPath = "/verify-email"; state.send.mockResolvedValue({ error: "Email unavailable." });
  await expect(loginAction(form())).rejects.toThrow("REDIRECT:/verify-email?error=Email%20unavailable.");
});
it("requires email verification even while a new account awaits approval", async () => {
  state.profile.status = "pending"; state.factorPath = "/verify-email";
  await expect(loginAction(form())).rejects.toThrow("REDIRECT:/verify-email?message=");
});
it("keeps shared demo sign-in and forced-password flows usable", async () => {
  state.profile.data_scope = "demo"; await expect(loginAction(form())).rejects.toThrow("REDIRECT:/dashboard");
  state.profile.must_change_password = true; await expect(loginAction(form())).rejects.toThrow("REDIRECT:/change-password");
});
it.each(["error", "wrong-user", "missing-session"])("does not issue an app cookie for invalid provider claims: %s", async mode => {
  if (mode === "error") state.claimsError = true;
  if (mode === "wrong-user") state.claims.sub = "other-user";
  if (mode === "missing-session") state.claims.session_id = undefined as unknown as string;
  await expect(loginAction(form())).rejects.toThrow("/login?error=Session");
  expect(state.set).not.toHaveBeenCalled(); expect(state.signOut).toHaveBeenCalledOnce();
});
it("does not issue an app cookie for disabled accounts or failed credentials", async () => {
  state.profile.status = "disabled";
  await expect(loginAction(form())).rejects.toThrow("/login?error=This"); expect(state.set).not.toHaveBeenCalled();
  state.passwordError = true;
  await expect(loginAction(form())).rejects.toThrow("/login?error=Email"); expect(state.set).not.toHaveBeenCalled();
});
it("permits six successful sign-ins in the same limiter window", async () => {
  state.profile.data_scope = "demo";
  for (let index = 0; index < 6; index++) await expect(loginAction(form())).rejects.toThrow("REDIRECT:/dashboard");
  expect(state.clear).toHaveBeenCalledTimes(6);
  expect(state.clear).toHaveBeenLastCalledWith("student@school.test");
});
it("retains failed attempts and blocks after five rejected passwords", async () => {
  state.passwordError = true;
  for (let index = 0; index < 5; index++) await expect(loginAction(form())).rejects.toThrow("/login?error=Email");
  await expect(loginAction(form())).rejects.toThrow("/login?error=Too");
  expect(state.clear).not.toHaveBeenCalled(); expect(state.set).not.toHaveBeenCalled();
});
it("signs out if successful authentication cannot reset the password counter", async () => {
  state.clear.mockRejectedValueOnce(new Error("private database detail"));
  await expect(loginAction(form())).rejects.toThrow("/login?error=Sign-in");
  expect(state.signOut).toHaveBeenCalledOnce(); expect(state.set).not.toHaveBeenCalled();
});
