import { beforeEach, expect, it, vi } from "vitest";
import { resetPasswordWithAuthenticator, RESET_DENIED } from "@/lib/forgot-password";
import { PASSWORD_RESET_PROOFS, resetProof } from "@/lib/password-reset-proof";

const m = vi.hoisted(() => ({
  profile: vi.fn(), user: vi.fn(), factors: vi.fn(), generate: vi.fn(), metadata: vi.fn(), verifySession: vi.fn(), verifyFactor: vi.fn(), claims: vi.fn(), signOut: vi.fn(), updateUser: vi.fn(), passwordOperation: vi.fn(), serialize: vi.fn(), client: vi.fn(), clearVerification: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ requireSupabaseEnv: () => ({ supabaseUrl: "https://test.invalid", supabasePublishableKey: "public-key" }) }));
vi.mock("@/lib/server-env", () => ({ requireSupabaseSecret: () => "private-test-secret" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => { const query = { select: () => query, eq: () => query, maybeSingle: m.profile }; return query; }, auth: { admin: { getUserById: m.user, generateLink: m.generate, updateUserById: m.metadata, mfa: { listFactors: m.factors } } } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => { m.client(...args); return { auth: { verifyOtp: m.verifySession, mfa: { challengeAndVerify: m.verifyFactor }, getClaims: m.claims, updateUser: m.updateUser, signOut: m.signOut } }; } }));
vi.mock("@/lib/mfa-operation", () => ({ serializeMfaOperation: m.serialize }));
vi.mock("@/lib/password-operation", () => ({ performPasswordUpdate: m.passwordOperation }));
vi.mock("@/lib/login-limit", () => ({ clearMfaVerificationAttempts: m.clearVerification }));

const email = "owner@test.invalid";
const profile = { id: "owner", email, status: "active", data_scope: "operational", updated_at: "version-before-lease" };
const code = "123456";
beforeEach(() => {
  vi.clearAllMocks();
  m.profile.mockReset().mockResolvedValue({ data: { ...profile, updated_at: "fresh-after-lease" }, error: null }).mockResolvedValueOnce({ data: profile, error: null });
  m.user.mockResolvedValue({ data: { user: { id: "owner", email, app_metadata: {} } }, error: null });
  m.factors.mockResolvedValue({ data: { factors: [{ id: "phone", status: "verified", factor_type: "totp" }] }, error: null });
  m.generate.mockResolvedValue({ data: { user: { id: "owner" }, properties: { hashed_token: "private-provider-token" } }, error: null });
  m.verifySession.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  m.verifyFactor.mockResolvedValue({ error: null }); m.claims.mockResolvedValue({ data: { claims: { sub: "owner", aal: "aal2" } }, error: null });
  m.metadata.mockResolvedValue({ error: null }); m.updateUser.mockResolvedValue({ error: null }); m.signOut.mockResolvedValue({ error: null });
  m.serialize.mockImplementation(async (_id, mutation) => mutation());
  m.passwordOperation.mockImplementation(async (_profile, mutation) => ({ ok: !(await mutation()).error }));
});

it.each(["missing", "disabled", "demo"])("does not mint sessions or change passwords for %s accounts", async mode => {
  m.profile.mockReset().mockResolvedValue({ data: mode === "missing" ? null : { ...profile, status: mode === "disabled" ? "disabled" : "active", data_scope: mode === "demo" ? "demo" : "operational" }, error: null });
  expect(await resetPasswordWithAuthenticator(email, code, "NewPassword123")).toEqual({ ok: false, error: RESET_DENIED });
  expect(m.generate).not.toHaveBeenCalled(); expect(m.passwordOperation).not.toHaveBeenCalled();
});
it.each([{ factors: [] }, { factors: [{ id: "pending", status: "unverified", factor_type: "totp" }] }, { factors: [{ id: "phone", status: "verified", factor_type: "phone" }] }])("requires an existing verified TOTP factor %#", async ({ factors }) => {
  m.factors.mockResolvedValue({ data: { factors }, error: null });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).ok).toBe(false);
  expect(m.generate).not.toHaveBeenCalled();
});
it("rejects an invalid code without consuming proof or changing a password", async () => {
  m.verifyFactor.mockResolvedValue({ error: { message: "private provider detail" } });
  expect(await resetPasswordWithAuthenticator(email, code, "NewPassword123")).toEqual({ ok: false, error: RESET_DENIED });
  expect(m.metadata).not.toHaveBeenCalled(); expect(m.passwordOperation).not.toHaveBeenCalled(); expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(m.clearVerification).not.toHaveBeenCalled();
});
it.each(["foreign-link", "foreign-session", "foreign-claims", "aal1"])("rejects %s before consuming proof", async mode => {
  if (mode === "foreign-link") m.generate.mockResolvedValue({ data: { user: { id: "other" }, properties: { hashed_token: "private-token" } }, error: null });
  if (mode === "foreign-session") m.verifySession.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
  if (mode === "foreign-claims" || mode === "aal1") m.claims.mockResolvedValue({ data: { claims: { sub: mode === "foreign-claims" ? "other" : "owner", aal: mode === "aal1" ? "aal1" : "aal2" } }, error: null });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).ok).toBe(false); expect(m.metadata).not.toHaveBeenCalled(); expect(m.passwordOperation).not.toHaveBeenCalled();
});
it("uses an isolated recovery session, actual AAL2 proof and a fresh password lease, then signs out", async () => {
  const result = await resetPasswordWithAuthenticator(email, code, "NewPassword123");
  expect(result).toEqual({ ok: true }); expect(JSON.stringify(result)).not.toContain("private-provider-token");
  expect(m.serialize).toHaveBeenCalledWith("owner", expect.any(Function));
  expect(m.generate).toHaveBeenCalledWith({ type: "recovery", email });
  expect(m.client).toHaveBeenCalledWith("https://test.invalid", "public-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  expect(m.verifyFactor).toHaveBeenCalledWith({ factorId: "phone", code });
  expect(m.passwordOperation).toHaveBeenCalledWith({ ...profile, updated_at: "fresh-after-lease" }, expect.any(Function), false);
  expect(m.updateUser).toHaveBeenCalledWith({ password: "NewPassword123" });
  expect(m.metadata.mock.invocationCallOrder[0]).toBeLessThan(m.passwordOperation.mock.invocationCallOrder[0]);
  expect(m.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(m.clearVerification).toHaveBeenCalledWith("owner");
  expect(JSON.stringify(m.metadata.mock.calls)).not.toContain(code);
});
it("rejects an already consumed code under the lease before minting a session", async () => {
  const proof = resetProof("owner", code, "private-test-secret");
  m.user.mockResolvedValue({ data: { user: { email, app_metadata: { [PASSWORD_RESET_PROOFS]: [{ proof, expires: Date.now() / 1000 + 180 }] } } }, error: null });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).ok).toBe(false); expect(m.generate).not.toHaveBeenCalled();
});
it("does not change a password if proof consumption fails", async () => {
  m.metadata.mockResolvedValue({ error: {} });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).ok).toBe(false); expect(m.passwordOperation).not.toHaveBeenCalled();
});
it("rejects a concurrent account disable after proof", async () => {
  m.profile.mockReset().mockResolvedValueOnce({ data: profile, error: null }).mockResolvedValueOnce({ data: { ...profile, status: "disabled" }, error: null });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).ok).toBe(false); expect(m.passwordOperation).not.toHaveBeenCalled();
});
it("does not restore a consumed OTP when the password operation fails", async () => {
  m.passwordOperation.mockResolvedValue({ ok: false });
  expect((await resetPasswordWithAuthenticator(email, code, "NewPassword123")).error).toContain("new authenticator code");
  expect(m.metadata).toHaveBeenCalledTimes(1); expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
});
