import { beforeEach, expect, it, vi } from "vitest";
import { RECOVERY_METADATA_KEY, recoveryCodeHash } from "@/lib/mfa-recovery";
import { recoverMfaAction, generateRecoveryCodeAction } from "@/app/actions/mfa";

const code = "11111111-22222222-33333333-44444444";
const mocks = vi.hoisted(() => ({
  context: { profile: { id: "alice", email: "alice@test.invalid", data_scope: "operational", must_change_password: false }, aal: "aal1" },
  getUser: vi.fn(), updateUser: vi.fn(), list: vi.fn(), remove: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), proofSignOut: vi.fn(), cookieDelete: vi.fn(), issue: vi.fn(), limit: vi.fn(), serialize: vi.fn(), resetManagement: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireProfile: async () => mocks.context.profile, getAuthContext: async () => mocks.context }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.cookieDelete }) }));
vi.mock("@/lib/login-limit", () => ({ consumeMfaAttempt: mocks.limit, clearMfaVerificationAttempts: vi.fn(), clearMfaManagementAttemptsAfterRecovery: mocks.resetManagement }));
vi.mock("@/lib/mfa-operation", () => ({ serializeMfaOperation: mocks.serialize }));
vi.mock("@/lib/mfa-recovery-store", () => ({ issueRecoveryCode: mocks.issue }));
vi.mock("@/lib/env", () => ({ requireSupabaseEnv: () => ({ supabaseUrl: "https://test.invalid", supabasePublishableKey: "test" }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.proofSignOut } }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { getUserById: mocks.getUser, updateUserById: mocks.updateUser, mfa: { listFactors: mocks.list, deleteFactor: mocks.remove } } } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.profile.data_scope = "operational"; mocks.context.profile.must_change_password = false; mocks.context.aal = "aal1";
  mocks.limit.mockResolvedValue(true);
  mocks.serialize.mockImplementation(async (_id, mutation) => mutation());
  mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { [RECOVERY_METADATA_KEY]: { hash: recoveryCodeHash("alice", code) } } } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.list.mockResolvedValue({ data: { factors: [{ id: "phone" }, { id: "backup" }] }, error: null });
  mocks.remove.mockResolvedValue({ error: null }); mocks.signIn.mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null }); mocks.proofSignOut.mockResolvedValue({ error: null }); mocks.issue.mockResolvedValue(code);
});
function form(recovery = code) { const form = new FormData(); form.set("password", "test-password"); form.set("recovery_code", recovery); return form; }

it("requires a signed-in password session and a valid recovery code before consuming or removing factors", async () => {
  expect((await recoverMfaAction({}, form("00000000-00000000-00000000-00000000"))).error).toContain("incorrect or already used");
  expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.signIn).not.toHaveBeenCalled();
});
it.each(["wrong-password", "foreign-user"])("does not consume a code after %s proof", async mode => {
  mocks.signIn.mockResolvedValueOnce({ data: { user: { id: mode === "foreign-user" ? "bob" : "alice" } }, error: mode === "wrong-password" ? {} : null });
  expect((await recoverMfaAction({}, form())).error).toContain("Password");
  expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});
it("consumes before deleting owned factors and signs out globally instead of granting portal assurance", async () => {
  await expect(recoverMfaAction({}, form())).rejects.toThrow("REDIRECT:/login?message=Recovery");
  expect(mocks.serialize).toHaveBeenCalledWith("alice", expect.any(Function));
  expect(mocks.updateUser).toHaveBeenCalledWith("alice", { app_metadata: { [RECOVERY_METADATA_KEY]: null } });
  expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
  expect(mocks.remove).toHaveBeenNthCalledWith(1, { userId: "alice", id: "phone" });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" }); expect(mocks.cookieDelete).toHaveBeenCalledWith("labtrack-session");
  expect(mocks.resetManagement).toHaveBeenCalledWith("alice");
});
it("fails closed when consumption cannot be persisted", async () => {
  mocks.updateUser.mockResolvedValueOnce({ error: {} });
  expect((await recoverMfaAction({}, form())).error).toContain("unavailable");
  expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
});
it("does not restore a consumed code after partial provider failure", async () => {
  mocks.remove.mockResolvedValueOnce({ error: {} });
  expect((await recoverMfaAction({}, form())).error).toContain("could not finish");
  expect(mocks.updateUser).toHaveBeenCalledTimes(1);
});
it.each(["demo", "verified"])("rejects recovery for %s context", async mode => {
  if (mode === "demo") mocks.context.profile.data_scope = "demo"; else mocks.context.aal = "aal2";
  expect((await recoverMfaAction({}, form())).error).toBeTruthy(); expect(mocks.getUser).not.toHaveBeenCalled();
});
it("applies the persistent attempt limiter before reading recovery state", async () => {
  mocks.limit.mockResolvedValueOnce(false);
  expect((await recoverMfaAction({}, form())).error).toContain("15 minutes"); expect(mocks.getUser).not.toHaveBeenCalled();
});
it("requires AAL2 for recovery setup, including before the first temporary password is replaced", async () => {
  expect((await generateRecoveryCodeAction({})).error).toContain("Verify");
  mocks.context.aal = "aal2"; mocks.context.profile.must_change_password = true;
  expect((await generateRecoveryCodeAction({})).recoveryCode).toBe(code);
  expect(mocks.serialize).toHaveBeenLastCalledWith("alice", expect.any(Function), { requirePrivatePassword: false });
  mocks.context.profile.must_change_password = false;
  expect((await generateRecoveryCodeAction({})).recoveryCode).toBe(code);
  expect(mocks.serialize).toHaveBeenLastCalledWith("alice", expect.any(Function), { requirePrivatePassword: true });
});
