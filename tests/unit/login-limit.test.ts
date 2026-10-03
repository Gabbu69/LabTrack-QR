import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.rpc }) }));
import { consumeLoginAttempt, consumeMfaAttempt } from "@/lib/login-limit";
beforeEach(() => { vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret"); state.rpc.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
it("normalizes email and stores only a keyed hash", async () => {
  state.rpc.mockResolvedValue({ data: true, error: null });
  expect(await consumeLoginAttempt(" Student@School.edu ")).toBe(true);
  await consumeLoginAttempt("student@school.edu");
  expect(state.rpc.mock.calls[0]).toEqual(state.rpc.mock.calls[1]);
  expect(state.rpc.mock.calls[0][1].p_key).toMatch(/^[0-9a-f]{64}$/);
});
it("fails closed on a blocked account or unavailable database", async () => {
  state.rpc.mockResolvedValueOnce({ data: false, error: null });
  expect(await consumeLoginAttempt("student@school.edu")).toBe(false);
  state.rpc.mockResolvedValueOnce({ data: null, error: { message: "private SQL detail" } });
  await expect(consumeLoginAttempt("student@school.edu")).rejects.toThrow("Login protection is unavailable.");
});
it("isolates OTP and device-management counters from password login", async () => {
  state.rpc.mockResolvedValue({ data: true, error: null });
  await consumeLoginAttempt("user-id"); await consumeMfaAttempt("user-id"); await consumeMfaAttempt("user-id", "manage");
  const keys = state.rpc.mock.calls.map(call => call[1].p_key);
  expect(new Set(keys).size).toBe(3); expect(keys.every(key => /^[0-9a-f]{64}$/.test(key))).toBe(true);
});
it("fails closed when OTP protection is unavailable", async () => {
  state.rpc.mockResolvedValueOnce({ data: false, error: null }); expect(await consumeMfaAttempt("user-id")).toBe(false);
  state.rpc.mockResolvedValueOnce({ data: null, error: {} }); await expect(consumeMfaAttempt("user-id")).rejects.toThrow("Authenticator protection is unavailable.");
});
