import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ update: vi.fn(), rpc: vi.fn(), allowed: true }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: async () => {
  if (!state.allowed) throw new Error("ACCESS_DENIED");
  return { id: "verified-user", role: "student", status: "active", group_number: "1" };
} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: state.rpc, auth: { updateUser: state.update } }) }));
import { updateProfileAction } from "@/app/actions/auth";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ full_name: "Example Student", student_id: "ST-1", year_section: "2 / A", contact_number: "09000000000" })) data.set(key, value);
  return data;
}
beforeEach(() => { vi.clearAllMocks(); state.allowed = true; state.rpc.mockResolvedValue({ error: null }); state.update.mockResolvedValue({ error: null }); });
it("saves other profile edits without erasing course metadata when its disabled field is omitted", async () => {
  await expect(updateProfileAction(form())).rejects.toThrow("/profile?message=Profile");
  expect(state.rpc).toHaveBeenCalledWith("update_my_profile", expect.objectContaining({ p_full_name: "Example Student" }));
  expect(state.update).not.toHaveBeenCalled();
});
it.each(["Updated course", ""])("still saves an explicitly submitted course, including intentional clearing: %s", async program => {
  const data = form(); data.set("program", program);
  await expect(updateProfileAction(data)).rejects.toThrow("/profile?message=Profile");
  expect(state.update).toHaveBeenCalledWith({ data: { program } });
});
it("keeps the existing partial-save notice if metadata update fails", async () => {
  state.update.mockResolvedValue({ error: {} }); const data = form(); data.set("program", "New course");
  await expect(updateProfileAction(data)).rejects.toThrow("/profile?error=Your");
});
it("retains the authorization gate before any profile save", async () => {
  state.allowed = false;
  await expect(updateProfileAction(form())).rejects.toThrow("ACCESS_DENIED");
  expect(state.rpc).not.toHaveBeenCalled(); expect(state.update).not.toHaveBeenCalled();
});
