import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "private-fixture");
  vi.stubEnv("TURNSTILE_HOSTNAMES", "labtrack-qr.vercel.app");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, hostname: "labtrack-qr.vercel.app", action: "login" }) }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("validates with Cloudflare on the server and accepts the expected host and action", async () => {
  expect(await verifyTurnstile("single-use-token", "login")).toBe(true);
  expect(fetch).toHaveBeenCalledWith("https://challenges.cloudflare.com/turnstile/v0/siteverify", expect.objectContaining({ method: "POST", cache: "no-store" }));
  expect((vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams).get("response")).toBe("single-use-token");
});
it.each([
  { success: false, hostname: "labtrack-qr.vercel.app", action: "login" },
  { success: true, hostname: "attacker.example", action: "login" },
  { success: true, hostname: "labtrack-qr.vercel.app", action: "password_reset" },
  { success: "true", hostname: "labtrack-qr.vercel.app", action: "login" },
])("rejects an invalid provider result %#", async result => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result } as Response);
  expect(await verifyTurnstile("token", "login")).toBe(false);
});
it("rejects missing or oversized tokens without sending a request", async () => {
  expect(await verifyTurnstile("", "login")).toBe(false);
  expect(await verifyTurnstile("a".repeat(2049), "login")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["TURNSTILE_SECRET_KEY", "TURNSTILE_HOSTNAMES"])("fails closed without %s", async key => {
  vi.stubEnv(key, ""); expect(await verifyTurnstile("token", "login")).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
it("does not permit Cloudflare's test secret in Vercel production", async () => {
  vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  expect(await verifyTurnstile("token", "login")).toBe(false);
});
it("rejects outages and malformed responses without leaking secrets", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("private-fixture"));
  expect(await verifyTurnstile("token", "login")).toBe(false);
  vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
  expect(await verifyTurnstile("token", "login")).toBe(false);
});
