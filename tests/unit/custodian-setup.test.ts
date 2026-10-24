import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ invitation: { name: "Approved Custodian", email: "owner@example.test" } as { name: string; email: string } | null, allowed: true, created: vi.fn(), updated: vi.fn(), createError: false, profileError: false }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/custodian-invitation", () => ({ readCustodianInvitation: () => state.invitation }));
vi.mock("@/lib/server-env", () => ({ requireSupabaseSecret: () => "test-secret" }));
vi.mock("@/lib/login-limit", () => ({ consumeLoginAttempt: async () => state.allowed }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  auth: { admin: { createUser: async (input: unknown) => { state.created(input); return state.createError ? { data: { user: null }, error: { message: "private provider information" } } : { data: { user: { id: "new-account" } }, error: null }; } } },
  from: () => { const query = { update: (input: unknown) => { state.updated(input); return query; }, eq: () => query, select: () => query,
    single: async () => ({ data: { role: "custodian", status: "active", data_scope: "operational", must_change_password: false }, error: state.profileError ? {} : null }) }; return query; },
}) }));
import { createCustodianAccountAction } from "@/app/actions/custodian-setup";

function form() { const form = new FormData(); form.set("invitation", "signed-test-token"); form.set("password", "ChosenPassword123"); form.set("confirmation", "ChosenPassword123"); return form; }
beforeEach(() => { vi.clearAllMocks(); state.invitation = { name: "Approved Custodian", email: "owner@example.test" }; state.allowed = true; state.createError = false; state.profileError = false; });

it("creates only the owner-approved operational custodian with the chosen private password", async () => {
  const data = form(); data.set("email", "attacker@example.test"); data.set("role", "instructor"); data.set("data_scope", "demo");
  await expect(createCustodianAccountAction({}, data)).rejects.toThrow("REDIRECT:/login?message=Custodian");
  expect(state.created).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.test", password: "ChosenPassword123", user_metadata: { full_name: "Approved Custodian" }, app_metadata: { labtrack_staff_role: "custodian", labtrack_data_scope: "operational" } }));
  expect(state.updated).toHaveBeenCalledWith({ full_name: "Approved Custodian", role: "custodian", status: "active", data_scope: "operational", must_change_password: false, student_id: null });
});

it("rejects an invalid invitation before using admin privileges", async () => {
  state.invitation = null;
  expect((await createCustodianAccountAction({}, form())).error).toMatch(/invalid or expired/);
  expect(state.created).not.toHaveBeenCalled(); expect(state.updated).not.toHaveBeenCalled();
});

it("requires a matching strong password without creating an account", async () => {
  const data = form(); data.set("confirmation", "DifferentPassword123");
  expect((await createCustodianAccountAction({}, data)).error).toMatch(/same password twice/);
  expect(state.created).not.toHaveBeenCalled();
});

it("fails closed when setup is throttled", async () => {
  state.allowed = false;
  expect((await createCustodianAccountAction({}, form())).error).toMatch(/Too many/);
  expect(state.created).not.toHaveBeenCalled();
});

it("does not overwrite an existing account or leak provider details after a rejected create", async () => {
  state.createError = true;
  const result = await createCustodianAccountAction({}, form());
  expect(result.error).toMatch(/already completed setup/);
  expect(result.error).not.toMatch(/private provider/);
  expect(state.updated).not.toHaveBeenCalled();
});

it("does not retry profile provisioning or claim success when account creation is incomplete", async () => {
  state.profileError = true;
  expect((await createCustodianAccountAction({}, form())).error).toMatch(/Do not repeat setup/);
  expect(state.created).toHaveBeenCalledTimes(1);
});
