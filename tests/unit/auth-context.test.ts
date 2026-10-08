import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types/app";
import { getAuthContext, getProfile, requireProfile } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  configured: true,
  claims: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  profile: vi.fn(),
  cookie: vi.fn(),
  session: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T>(callback: T) => callback }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("@/lib/session-policy", () => ({ SESSION_COOKIE: "labtrack-session", readSession: mocks.session }));
vi.mock("next/navigation", () => ({ redirect: (path: string): never => { throw new Error(`REDIRECT:${path}`); } }));

const account = {
  id: "user-1", role: "student", status: "active", data_scope: "operational", must_change_password: false,
} as Profile;
const session = { user: account.id, session: "session-1", started: 10, seen: 20 };

function claims(aal: unknown, overrides: Record<string, unknown> = {}) {
  mocks.claims.mockResolvedValue({ data: { claims: { sub: account.id, session_id: session.session, aal, ...overrides } }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  claims("aal1");
  mocks.profile.mockResolvedValue({ data: { ...account }, error: null });
  mocks.cookie.mockReturnValue({ value: "signed-cookie" });
  mocks.session.mockReturnValue(session);
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.profile };
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getClaims: mocks.claims }, from: mocks.from, rpc: mocks.rpc });
});

describe("signed authentication context", () => {
  it("retains an AAL1 identity for setup without granting portal access", async () => {
    expect(await getAuthContext()).toEqual({ profile: account, aal: "aal1", session, emailOtpVerified: false });
    expect(mocks.session).toHaveBeenCalledWith("signed-cookie", account.id, session.session);
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.eq).toHaveBeenCalledWith("id", account.id);
    expect(await getProfile()).toBeNull();
  });

  it("does not create an auth client without configuration", async () => {
    mocks.configured = false;
    expect(await getAuthContext()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    { sub: undefined }, { sub: 123 }, { session_id: undefined }, { session_id: 123 },
  ])("rejects an incomplete provider identity %#", async (overrides) => {
    claims("aal2", overrides);
    expect(await getAuthContext()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects a provider error even if claim data is present", async () => {
    mocks.claims.mockResolvedValueOnce({ data: { claims: { sub: account.id, session_id: session.session, aal: "aal2" } }, error: { message: "provider failure" } });
    expect(await getAuthContext()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an absent, expired, or mismatched signed app session", async () => {
    mocks.session.mockReturnValueOnce(null);
    expect(await getAuthContext()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an identity without a profile", async () => {
    mocks.profile.mockResolvedValueOnce({ data: null, error: null });
    expect(await getAuthContext()).toBeNull();
  });

  it("does not leak a profile-query exception", async () => {
    mocks.profile.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
    await expect(getAuthContext()).rejects.toThrow("Account details could not be loaded");
  });
});

describe("portal authentication assurance", () => {
  it("accepts email verification only from the database for the signed provider session", async () => {
    mocks.session.mockReturnValue({ ...session, emailOtpSent: 15 });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await getProfile()).toEqual(account);
    expect(mocks.rpc).toHaveBeenCalledWith("email_otp_verified");
  });

  it("does not trust the signed send timestamp as successful email verification", async () => {
    mocks.session.mockReturnValue({ ...session, emailOtpSent: 15 });
    expect(await getProfile()).toBeNull();
  });

  it("fails closed if the email verification lookup is unavailable", async () => {
    mocks.session.mockReturnValue({ ...session, emailOtpSent: 15 });
    mocks.rpc.mockResolvedValue({ data: true, error: { message: "private detail" } });
    await expect(getProfile()).rejects.toThrow("Account verification could not be loaded");
  });
  it.each(["aal1", undefined, null, "unknown"])("does not authorize operational access at assurance %s", async (aal) => {
    claims(aal);
    expect(await getProfile()).toBeNull();
    await expect(requireProfile()).rejects.toThrow("REDIRECT:/two-factor");
  });

  it("authorizes an operational AAL2 session", async () => {
    claims("aal2");
    expect(await getProfile()).toEqual(account);
    expect(await requireProfile()).toEqual(account);
  });

  it("exempts only the trusted demo profile scope", async () => {
    mocks.profile.mockResolvedValue({ data: { ...account, data_scope: "demo" }, error: null });
    expect((await getProfile())?.data_scope).toBe("demo");
    expect((await requireProfile()).data_scope).toBe("demo");
  });

  it("denies disabled accounts even when second-factor assurance is valid", async () => {
    claims("aal2");
    mocks.profile.mockResolvedValue({ data: { ...account, status: "disabled" }, error: null });
    expect(await getProfile()).toBeNull();
    await expect(requireProfile()).rejects.toThrow("REDIRECT:/login?error=");
  });

  it("still requires a mandatory password change after MFA", async () => {
    claims("aal2");
    mocks.profile.mockResolvedValue({ data: { ...account, must_change_password: true }, error: null });
    expect(await getProfile()).toBeNull();
    await expect(requireProfile()).rejects.toThrow("REDIRECT:/change-password");
  });

  it("does not turn the password-change exception into an MFA bypass", async () => {
    mocks.profile.mockResolvedValue({ data: { ...account, must_change_password: true }, error: null });
    await expect(requireProfile(undefined, { allowPasswordChange: true })).rejects.toThrow("REDIRECT:/two-factor");
  });

  it("permits only explicit setup paths to use the pending identity", async () => {
    mocks.profile.mockResolvedValue({ data: { ...account, must_change_password: true }, error: null });
    expect(await requireProfile(undefined, { allowMfaSetup: true, allowPasswordChange: true })).toEqual({ ...account, must_change_password: true });
  });

  it("keeps role authorization active during MFA setup", async () => {
    await expect(requireProfile(["custodian"], { allowMfaSetup: true })).rejects.toThrow("REDIRECT:/dashboard?error=");
  });
});
