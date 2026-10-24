import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "custodian", aal: "aal2", created: vi.fn(), updated: vi.fn(), duplicate: false }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCustodian: async () => {
  if (state.role !== "custodian" || state.aal !== "aal2") throw new Error("ACCESS_DENIED");
  return { id: "custodian", role: state.role, data_scope: "operational" };
} }));
vi.mock("@/lib/registration", () => ({ studentIdInUse: async () => state.duplicate }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  auth: { admin: { createUser: async (input: unknown) => { state.created(input); return { data: { user: { id: "new-student" } }, error: null }; } } },
  from: () => ({ update: (input: unknown) => { state.updated(input); return { eq: async () => ({ error: null }) }; } }),
}) }));
import { createStudentAction } from "@/app/actions/operations";

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ full_name: "Student Example", email: "student@example.test", student_id: "ST-100", year_section: "2nd year / A", program: "Aircraft Maintenance Technology", contact_number: "09123456789", temporary_password: "TemporaryPassword123", role: "custodian", data_scope: "demo" })) data.set(key, value);
  return data;
}
beforeEach(() => { vi.clearAllMocks(); state.role = "custodian"; state.aal = "aal2"; state.duplicate = false; });

it("creates an active student in the verified custodian's scope with a required password change", async () => {
  await expect(createStudentAction(form())).rejects.toThrow("REDIRECT:/users?message=Student");
  expect(state.created).toHaveBeenCalledWith(expect.objectContaining({ app_metadata: { labtrack_data_scope: "operational", labtrack_managed_account: true }, user_metadata: expect.objectContaining({ program: "Aircraft Maintenance Technology" }) }));
  expect(state.updated).toHaveBeenCalledWith(expect.objectContaining({ role: "student", status: "active", data_scope: "operational", must_change_password: true }));
});
it.each(["student", "instructor", "anonymous"])("rejects account creation by %s", async role => {
  state.role = role;
  await expect(createStudentAction(form())).rejects.toThrow("ACCESS_DENIED");
  expect(state.created).not.toHaveBeenCalled();
});
it("requires the custodian's authenticator verification", async () => {
  state.aal = "aal1";
  await expect(createStudentAction(form())).rejects.toThrow("ACCESS_DENIED");
  expect(state.created).not.toHaveBeenCalled();
});
it("blocks duplicate student IDs and incomplete details without creating Auth users", async () => {
  state.duplicate = true;
  await expect(createStudentAction(form())).rejects.toThrow("This%20Student%20ID");
  state.duplicate = false; const invalid = form(); invalid.set("student_id", "");
  await expect(createStudentAction(invalid)).rejects.toThrow("Complete%20the%20student%20details");
  expect(state.created).not.toHaveBeenCalled();
});
