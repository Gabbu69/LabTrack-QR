import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", data_scope: "operational" },
  role: "custodian", aal: "aal2",
  target: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "unused@school.test", data_scope: "operational" },
  targetError: false, linked: "", readError: false,
  deleted: vi.fn(), list: vi.fn(), remove: vi.fn(), admin: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${decodeURIComponent(url)}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCustodian: async () => {
  if (state.role !== "custodian" || state.aal !== "aal2") throw new Error("ACCESS_DENIED");
  return state.actor;
} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: state.target, error: state.targetError }) }; return query;
} }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: state.admin }));
import { deleteUserAction } from "@/app/actions/operations";

function form() {
  const data = new FormData(); data.set("profile_id", state.target.id); data.set("confirmation_email", state.target.email); return data;
}
beforeEach(() => {
  vi.clearAllMocks(); state.role = "custodian"; state.aal = "aal2";
  state.target = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "unused@school.test", data_scope: "operational" };
  state.actor.data_scope = "operational"; state.linked = ""; state.readError = false; state.targetError = false;
  state.deleted.mockResolvedValue({ error: null }); state.list.mockResolvedValue({ data: [], error: null }); state.remove.mockResolvedValue({ error: null });
  state.admin.mockReturnValue({ auth: { admin: { deleteUser: state.deleted } }, storage: { from: () => ({ list: state.list, remove: state.remove }) }, from: (table: string) => {
    const query = { select: () => query, eq: () => query, or: () => query, limit: async () => ({ data: state.linked === table ? [{ id: "linked" }] : [], error: state.readError }) }; return query;
  } });
});
it("permanently deletes the confirmed unused Auth user, allowing the profile FK to cascade", async () => {
  await expect(deleteUserAction(form())).rejects.toThrow("message=User account permanently deleted");
  expect(state.deleted).toHaveBeenCalledExactlyOnceWith(state.target.id);
});
it.each(["student", "instructor", "anonymous"])("rejects deletion by %s", async role => {
  state.role = role;
  await expect(deleteUserAction(form())).rejects.toThrow("ACCESS_DENIED"); expect(state.admin).not.toHaveBeenCalled();
});
it("requires MFA and rejects self deletion", async () => {
  state.aal = "aal1"; await expect(deleteUserAction(form())).rejects.toThrow("ACCESS_DENIED");
  state.aal = "aal2"; state.target.id = state.actor.id;
  await expect(deleteUserAction(form())).rejects.toThrow("cannot delete your current account"); expect(state.admin).not.toHaveBeenCalled();
});
it.each(["scope", "lookup", "demo", "confirmation", "invalid-id"])("rejects unsafe target: %s", async mode => {
  if (mode === "scope") state.target.data_scope = "demo";
  if (mode === "lookup") state.targetError = true;
  if (mode === "demo") { state.target.data_scope = "demo"; state.actor.data_scope = "demo"; state.target.email = "jordan.demo@labtrackqr2026.com"; }
  const data = form();
  if (mode === "confirmation") data.set("confirmation_email", "different@school.test");
  if (mode === "invalid-id") data.set("profile_id", "bad-id");
  await expect(deleteUserAction(data)).rejects.toThrow("/users?error="); expect(state.admin).not.toHaveBeenCalled();
});
it.each(["tools", "transactions", "transaction_items"])("preserves accounts referenced by %s and gives the Disable alternative", async table => {
  state.linked = table;
  await expect(deleteUserAction(form())).rejects.toThrow("Use Disable");
  expect(state.deleted).not.toHaveBeenCalled(); expect(state.list).not.toHaveBeenCalled();
});
it("fails closed when reference reads fail", async () => {
  state.readError = true;
  await expect(deleteUserAction(form())).rejects.toThrow("records could not be checked"); expect(state.deleted).not.toHaveBeenCalled();
});
it("removes every owned profile photo before Auth deletion, including paginated old uploads", async () => {
  state.list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `${i}.webp` })), error: null })
    .mockResolvedValueOnce({ data: [{ id: "last", name: "last.webp" }], error: null });
  await expect(deleteUserAction(form())).rejects.toThrow("message=User account");
  expect(state.list).toHaveBeenNthCalledWith(2, state.target.id, expect.objectContaining({ offset: 100 }));
  expect(state.remove).toHaveBeenCalledTimes(2);
  expect(state.remove).toHaveBeenLastCalledWith([`${state.target.id}/last.webp`]);
  expect(state.remove.mock.invocationCallOrder[1]).toBeLessThan(state.deleted.mock.invocationCallOrder[0]);
});
it.each(["list", "remove", "delete"])("reports %s failure without claiming success", async stage => {
  state.list.mockResolvedValue({ data: [{ id: "photo", name: "photo.webp" }], error: stage === "list" ? {} : null });
  state.remove.mockResolvedValue({ error: stage === "remove" ? {} : null });
  state.deleted.mockResolvedValue({ error: stage === "delete" ? {} : null });
  await expect(deleteUserAction(form())).rejects.toThrow("/users?error=");
  if (stage !== "delete") expect(state.deleted).not.toHaveBeenCalled();
});
