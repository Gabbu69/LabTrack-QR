import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.rpc }) }));
import { clearLoginAttempts, clearMfaVerificationAttempts, consumeLoginAttempt, consumeMfaAttempt } from "@/lib/login-limit";
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
it("clears the same normalized password hash only after the server requests a reset", async () => {
  state.rpc.mockResolvedValue({ data: true, error: null });
  await consumeLoginAttempt(" Student@School.edu ");
  await clearLoginAttempts("student@school.edu");
  expect(state.rpc.mock.calls[1]).toEqual(["reset_login_attempts", state.rpc.mock.calls[0][1]]);
});
it("clears verification without clearing password or device-management attempts", async () => {
  state.rpc.mockResolvedValue({ data: true, error: null });
  await consumeMfaAttempt("user-id", "manage");
  await consumeMfaAttempt("user-id", "verify");
  await clearMfaVerificationAttempts("user-id");
  expect(state.rpc.mock.calls[2]).toEqual(["reset_login_attempts", state.rpc.mock.calls[1][1]]);
  expect(state.rpc.mock.calls[2][1]).not.toEqual(state.rpc.mock.calls[0][1]);
});
it("reports unavailable resets without exposing SQL details", async () => {
  state.rpc.mockResolvedValue({ data: null, error: { message: "private SQL detail" } });
  await expect(clearLoginAttempts("student@school.edu")).rejects.toThrow("Login protection is unavailable.");
  await expect(clearMfaVerificationAttempts("user-id")).rejects.toThrow("Authenticator protection is unavailable.");
});
