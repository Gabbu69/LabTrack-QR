import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSharedDemoIdentity, SHARED_DEMO_EMAILS } from "@/lib/demo-identities";

const state = vi.hoisted(() => ({
  actor: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", data_scope: "demo" },
  target: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "jordan.demo@labtrackqr2026.com", data_scope: "demo", updated_at: "version", status: "active" },
  rpc: vi.fn(), admin: vi.fn(), passwordUpdate: vi.fn(), updateAuth: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string): never => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCustodian: async () => state.actor, requireProfile: async () => state.target }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: state.target, error: null }) }; return query; },
  rpc: state.rpc, auth: { updateUser: state.updateAuth },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: state.admin }));
vi.mock("@/lib/password-operation", () => ({ performPasswordUpdate: state.passwordUpdate }));

import { changePasswordAction } from "@/app/actions/auth";
import { resetPasswordAction, setProfileStatusAction } from "@/app/actions/operations";

function form(fields: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, value);
  return result;
}
const passwordFields = { password: "Private-password-99", confirmation: "Private-password-99" };
function resetFields() { return { profile_id: state.target.id, temporary_password: "Temporary-password-99" }; }

beforeEach(() => {
  vi.clearAllMocks();
  state.actor.data_scope = "demo";
  state.target = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "jordan.demo@labtrackqr2026.com", data_scope: "demo", updated_at: "version", status: "active" };
  state.rpc.mockResolvedValue({ error: null });
  state.updateAuth.mockResolvedValue({ error: null });
  state.admin.mockReturnValue({ auth: { admin: { updateUserById: state.updateAuth } } });
  state.passwordUpdate.mockImplementation(async (_profile, callback) => { await callback(); return { ok: true }; });
});

describe("canonical shared demo identities", () => {
  it.each(SHARED_DEMO_EMAILS)("protects %s only in trusted demo scope", email => {
    expect(isSharedDemoIdentity({ email: ` ${email.toUpperCase()} `, data_scope: "demo" })).toBe(true);
    expect(isSharedDemoIdentity({ email, data_scope: "operational" })).toBe(false);
  });
  it.each(["new.staff@school.test", "jordan.demo@other.test", "fake@labtrackqr2026.com", ""])("does not freeze a non-seeded identity %s", email => {
    expect(isSharedDemoIdentity({ email, data_scope: "demo" })).toBe(false);
  });
});

describe("shared account mutation guards", () => {
  it.each(SHARED_DEMO_EMAILS)("rejects direct password changes for %s before Auth or profile writes", async email => {
    state.target.email = email;
    await expect(changePasswordAction(form(passwordFields))).rejects.toThrow("/change-password?error=Shared");
    expect(state.passwordUpdate).not.toHaveBeenCalled(); expect(state.updateAuth).not.toHaveBeenCalled();
  });
  it.each(SHARED_DEMO_EMAILS)("rejects custodian password resets for %s", async email => {
    state.target.email = email;
    await expect(resetPasswordAction(form(resetFields()))).rejects.toThrow("/users?error=Shared");
    expect(state.admin).not.toHaveBeenCalled(); expect(state.passwordUpdate).not.toHaveBeenCalled();
  });
  it.each(SHARED_DEMO_EMAILS)("rejects disabling %s through a forged server action", async email => {
    state.target.email = email;
    await expect(setProfileStatusAction(form({ profile_id: state.target.id, status: "disabled", email: "disposable@school.test", data_scope: "operational" }))).rejects.toThrow("/users?error=Shared");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("does not let a shared identity become pending", async () => {
    await expect(setProfileStatusAction(form({ profile_id: state.target.id, status: "pending" }))).rejects.toThrow("/users?error=Shared");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("allows activation for owner-restored demonstration access", async () => {
    await expect(setProfileStatusAction(form({ profile_id: state.target.id, status: "active" }))).rejects.toThrow("/users?message=Account");
    expect(state.rpc).toHaveBeenCalledWith("set_profile_status", { p_profile_id: state.target.id, p_status: "active" });
  });
  it("allows new demo staff to replace a temporary password", async () => {
    state.target.email = "new.staff@school.test";
    await expect(changePasswordAction(form(passwordFields))).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.passwordUpdate).toHaveBeenCalledWith(state.target, expect.any(Function), false);
    expect(state.updateAuth).toHaveBeenCalledWith({ password: passwordFields.password });
  });
  it("allows temporary password resets and disabling for new demo staff", async () => {
    state.target.email = "new.staff@school.test";
    await expect(resetPasswordAction(form(resetFields()))).rejects.toThrow("/users?message=Temporary");
    expect(state.passwordUpdate).toHaveBeenCalledWith(state.target, expect.any(Function), true);
    await expect(setProfileStatusAction(form({ profile_id: state.target.id, status: "disabled" }))).rejects.toThrow("/users?message=Account");
    expect(state.rpc).toHaveBeenCalledOnce();
  });
  it("requires the target to be in the custodian's actual scope", async () => {
    state.target.data_scope = "operational";
    await expect(resetPasswordAction(form(resetFields()))).rejects.toThrow("/users?error=Account");
    await expect(setProfileStatusAction(form({ profile_id: state.target.id, status: "disabled" }))).rejects.toThrow("/users?error=Account");
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.admin).not.toHaveBeenCalled();
  });
});
