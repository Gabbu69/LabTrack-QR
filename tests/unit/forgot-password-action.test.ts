import { beforeEach, expect, it, vi } from "vitest";
import { forgotPasswordAction } from "@/app/actions/forgot-password";
const m = vi.hoisted(() => ({ limit: vi.fn(), reset: vi.fn(), removeCookie: vi.fn(), clearLogin: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "198.51.100.20, 10.0.0.1" }), cookies: async () => ({ delete: m.removeCookie }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/login-limit", () => ({ consumePasswordResetAttempt: m.limit, clearLoginAttempts: m.clearLogin }));
vi.mock("@/lib/forgot-password", () => ({ resetPasswordWithAuthenticator: m.reset }));
vi.mock("@/lib/session-policy", () => ({ SESSION_COOKIE: "labtrack-session" }));
function form() { const form = new FormData(); for (const [key, value] of Object.entries({ email: " Student@School.edu ", code: "123456", password: "NewPassword123", confirmation: "NewPassword123" })) form.set(key, value); return form; }
beforeEach(() => { vi.clearAllMocks(); m.limit.mockResolvedValue(true); m.reset.mockResolvedValue({ ok: true }); });
it.each(["email", "code", "password", "confirmation"])("rejects invalid %s before reaching the provider", async key => {
  const data = form(); data.set(key, "invalid"); expect((await forgotPasswordAction({}, data)).error).toBeTruthy(); expect(m.reset).not.toHaveBeenCalled();
});
it("limits anonymous attempts before account lookup", async () => {
  m.limit.mockResolvedValue(false); expect((await forgotPasswordAction({}, form())).error).toContain("15 minutes"); expect(m.reset).not.toHaveBeenCalled();
});
it("returns to sign-in without granting an app session", async () => {
  await expect(forgotPasswordAction({}, form())).rejects.toThrow("REDIRECT:/login?message=Password%20reset");
  expect(m.reset).toHaveBeenCalledWith("student@school.edu", "123456", "NewPassword123"); expect(m.limit).toHaveBeenCalledWith("student@school.edu", "198.51.100.20"); expect(m.removeCookie).toHaveBeenCalledWith("labtrack-session");
  expect(m.clearLogin).toHaveBeenCalledWith("student@school.edu");
});
it("hides provider failures and does not redirect or change cookies after failure", async () => {
  m.reset.mockRejectedValue(new Error("private-provider-token")); const result = await forgotPasswordAction({}, form());
  expect(result.error).toContain("temporarily unavailable"); expect(JSON.stringify(result)).not.toContain("private-provider-token"); expect(m.removeCookie).not.toHaveBeenCalled();
});
