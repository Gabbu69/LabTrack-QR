import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readSession, signSession, IDLE_SECONDS, MAX_SESSION_SECONDS, authCookieOptions } from "@/lib/session-policy";

const base = { user: "user-1", session: "session-1", started: 100, seen: 100 };
beforeEach(() => vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret"));
afterEach(() => vi.unstubAllEnvs());
it("accepts only the same user and verified Supabase session", () => {
  const token = signSession(base);
  expect(readSession(token, "user-1", "session-1", 101)).toEqual(base);
  expect(readSession(token, "user-2", "session-1", 101)).toBeNull();
  expect(readSession(token, "user-1", "session-2", 101)).toBeNull();
});
it("rejects missing, modified and malformed cookies", () => {
  for (const token of [undefined, "bad", `${signSession(base)}x`, `${signSession(base)}.extra`]) {
    expect(readSession(token, base.user, base.session, 101)).toBeNull();
  }
});
it("expires at the idle boundary and never extends the absolute deadline", () => {
  expect(readSession(signSession(base), base.user, base.session, 100 + IDLE_SECONDS)).toBeNull();
  const refreshed = { ...base, seen: 100 + MAX_SESSION_SECONDS - 1 };
  expect(readSession(signSession(refreshed), base.user, base.session, 100 + MAX_SESSION_SECONDS)).toBeNull();
});
it("rejects future timestamps and uses HttpOnly SameSite cookies", () => {
  expect(readSession(signSession(base), base.user, base.session, 99)).toBeNull();
  expect(authCookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
});
