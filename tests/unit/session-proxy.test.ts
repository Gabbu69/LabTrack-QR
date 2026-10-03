import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/proxy";
import { SESSION_COOKIE, signSession, readSession } from "@/lib/session-policy";
const state = vi.hoisted(() => ({ sessionId: undefined as string | undefined, signOut: vi.fn() }));
beforeEach(() => { state.sessionId = undefined; state.signOut.mockReset(); vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret"); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => true,
  publicEnv: { supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "test-key" },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: Required<CookieMethodsServer> }) => ({
    auth: {
      signOut: state.signOut,
      getClaims: async () => {
        await cookies.setAll([{ name: "session", value: "refreshed", options: { httpOnly: true } }], {
          "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0",
          Pragma: "no-cache",
        });
        return { data: { claims: { sub: "test-user", session_id: state.sessionId } } };
      },
    },
  }),
}));

it("keeps refreshed auth responses private while forwarding the new session", async () => {
  const request = new NextRequest("https://labtrack.example/dashboard");
  const response = await updateSession(request);
  expect(request.cookies.get("session")?.value).toBe("refreshed");
  expect(response.cookies.get("session")?.value).toBe("refreshed");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Cache-Control")).toContain("private");
  expect(response.headers.get("Expires")).toBe("0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
});

it("signs out an authenticated session without a valid app cookie", async () => {
  state.sessionId = "session-1";
  const response = await updateSession(new NextRequest("https://labtrack.example/dashboard"));
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
});

it.each(["poll", "prefetch", "navigation"])("only real navigation extends inactivity: %s", async (kind) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(200_000));
  state.sessionId = "session-1";
  const token = signSession({ user: "test-user", session: "session-1", started: 100, seen: 100 });
  const request = new NextRequest(`https://labtrack.example/${kind === "poll" ? "api/session" : "dashboard"}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}`, ...(kind === "prefetch" ? { "next-router-prefetch": "1" } : {}) },
  });
  const response = await updateSession(request);
  if (kind === "navigation") {
    const value = response.cookies.get(SESSION_COOKIE)?.value;
    expect(readSession(value, "test-user", "session-1", 200)?.seen).toBe(200);
  } else expect(response.cookies.has(SESSION_COOKIE)).toBe(false);
  expect(state.signOut).not.toHaveBeenCalled();
});
