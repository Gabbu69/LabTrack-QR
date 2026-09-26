import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => true,
  publicEnv: { supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "test-key" },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: Required<CookieMethodsServer> }) => ({
    auth: {
      getClaims: async () => {
        await cookies.setAll([{ name: "session", value: "refreshed", options: { httpOnly: true } }], {
          "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0",
          Pragma: "no-cache",
        });
        return { data: { claims: { sub: "test-user" } } };
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
