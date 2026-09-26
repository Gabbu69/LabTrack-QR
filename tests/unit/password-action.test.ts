import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ authError: false, profileError: false, updatePassword: vi.fn(), updateProfile: vi.fn(), admin: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: vi.fn(async () => ({ id: "actor", updated_at: "version", status: "active", must_change_password: true })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { updateUser: async (input: unknown) => { state.updatePassword(input); return { error: state.authError ? {} : null }; } } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { state.admin(); return { from: () => ({ update: (input: unknown) => { state.updateProfile(input); const chain = { eq: () => chain, is: () => chain, neq: () => chain, select: () => chain, maybeSingle: async () => ({ data: state.profileError ? null : { id: "actor" }, error: null }) }; return chain; } }) }; } }));
import { changePasswordAction } from "@/app/actions/auth";
beforeEach(() => { vi.clearAllMocks(); state.authError = false; state.profileError = false; });
function form(password = "Private-test-99") { const data = new FormData(); data.set("password", password); data.set("confirmation", password); return data; }
it("never clears the mandatory-change flag after rejected password input", async () => { await expect(changePasswordAction(form("short"))).rejects.toThrow("/change-password?error="); expect(state.updatePassword).not.toHaveBeenCalled(); expect(state.admin).not.toHaveBeenCalled(); });
it("never clears the mandatory-change flag when Supabase rejects the password", async () => { state.authError = true; await expect(changePasswordAction(form())).rejects.toThrow("/change-password?error="); expect(state.updatePassword).toHaveBeenCalledOnce(); expect(state.updateProfile).not.toHaveBeenCalledWith(expect.objectContaining({must_change_password:false})); });
it("clears the restriction only after Supabase accepts the new password", async () => { await expect(changePasswordAction(form())).rejects.toThrow("REDIRECT:/dashboard"); expect(state.updateProfile).toHaveBeenCalledWith({ must_change_password: false, password_operation_id: null }); });
it("keeps the change screen when the profile version changes during the password request", async () => { state.profileError = true; await expect(changePasswordAction(form())).rejects.toThrow("/change-password?error="); });
