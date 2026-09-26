import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { single, admin } = vi.hoisted(() => ({ single: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }));
import { getDemoAccess } from "@/lib/demo-access";
beforeEach(() => {
  vi.stubEnv("DEMO_ACCOUNT_PASSWORD", "test-fixture-password");
  admin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }) });
  single.mockResolvedValue({ data: { role: "student", status: "active", data_scope: "demo", must_change_password: false }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("offers the allowed active demo account", async () => {
  expect(await getDemoAccess("student")).toEqual({ role: "student", email: "jordan.demo@labtrackqr2026.com", password: "test-fixture-password" });
});
it.each([undefined, "admin", "__proto__", "toString", ["student"]])("rejects an unknown role %s without database access", async (role) => {
  expect(await getDemoAccess(role)).toBeNull(); expect(admin).not.toHaveBeenCalled();
});
it.each([
  { data_scope: "operational" }, { status: "disabled" }, { status: "pending" },
  { must_change_password: true }, { role: "custodian" },
])("never publishes credentials for an ineligible profile %j", async (override) => {
  single.mockResolvedValue({ data: { role: "student", status: "active", data_scope: "demo", must_change_password: false, ...override }, error: null });
  expect(await getDemoAccess("student")).toBeNull();
});
it("fails closed on unavailable database or missing configuration", async () => {
  single.mockRejectedValue(new Error("offline")); expect(await getDemoAccess("student")).toBeNull();
  vi.stubEnv("DEMO_ACCOUNT_PASSWORD", ""); expect(await getDemoAccess("student")).toBeNull();
});
