import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { loadProfileMetadata } from "@/lib/profile-metadata";
const profile = { id: "verified-user", program: "Previous course" };
const client = (getUser: ReturnType<typeof vi.fn>) => ({ auth: { getUser } }) as unknown as Pick<SupabaseClient<Database>, "auth">;
afterEach(() => vi.restoreAllMocks());
it("uses the fresh account metadata instead of a stale JWT value", async () => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: profile.id, user_metadata: { program: "Updated course" } } }, error: null });
  expect(await loadProfileMetadata(client(getUser), profile)).toEqual({ program: "Updated course", programEditable: true });
});
it.each([0, 429, 500, 503])("keeps the verified profile usable during temporary provider failure %s", async status => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { code: "request_timeout", status, message: "private provider body" } });
  expect(await loadProfileMetadata(client(getUser), profile)).toEqual({ program: "Previous course", programEditable: false });
  expect(JSON.stringify(warn.mock.calls)).not.toContain("private provider body");
});
it("keeps the optional metadata read from crashing on a network exception", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await loadProfileMetadata(client(vi.fn().mockRejectedValue(new Error("network"))), profile)).toEqual({ program: "Previous course", programEditable: false });
});
it.each([400, 401, 403])("redirects invalid authentication %s to sign-in instead of a broken page", async status => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { status } });
  await expect(loadProfileMetadata(client(getUser), profile)).rejects.toThrow("REDIRECT:/login?error=Your");
});
it.each(["session_not_found", "session_expired", "user_not_found", "user_banned", "bad_jwt", "refresh_token_not_found"])("never treats %s as an availability fallback", async code => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { code } });
  await expect(loadProfileMetadata(client(getUser), profile)).rejects.toThrow("REDIRECT:/login");
});
it.each([null, { id: "another-user", user_metadata: { program: "Wrong course" } }])("rejects absent or mismatched provider identity %#", async user => {
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  await expect(loadProfileMetadata(client(getUser), profile)).rejects.toThrow("REDIRECT:/login");
});
it.each([null, 42, { unexpected: true }])("handles a non-string course without crashing %#", async program => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: profile.id, user_metadata: { program } } }, error: null });
  expect(await loadProfileMetadata(client(getUser), profile)).toEqual({ program: "", programEditable: true });
});
