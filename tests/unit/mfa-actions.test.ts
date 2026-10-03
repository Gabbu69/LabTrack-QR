import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types/app";
import { enrollMfaAction, removeMfaAction, verifyMfaAction } from "@/app/actions/mfa";
import { IDLE_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE } from "@/lib/session-policy";

type Context = {
  profile: Profile;
  aal: unknown;
  session: { user: string; session: string; started: number; seen: number };
};
type Factor = { id: string; factor_type: string; status: string };

const mocks = vi.hoisted(() => ({
  context: null as Context | null,
  requireProfile: vi.fn(),
  consumeAttempt: vi.fn(),
  createClient: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  verify: vi.fn(),
  refresh: vi.fn(),
  claims: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  signSession: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: async () => mocks.context,
  requireProfile: mocks.requireProfile,
}));
vi.mock("@/lib/login-limit", () => ({ consumeMfaAttempt: mocks.consumeAttempt }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie, delete: mocks.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string): never => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/session-policy", () => ({
  SESSION_COOKIE: "labtrack-session",
  IDLE_SECONDS: 1800,
  MAX_SESSION_SECONDS: 28800,
  authCookieOptions: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
  signSession: mocks.signSession,
}));

const userId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
const foreignId = "44444444-4444-4444-8444-444444444444";
const now = 100_000;
const first: Factor = { id: firstId, factor_type: "totp", status: "verified" };
const second: Factor = { id: secondId, factor_type: "totp", status: "verified" };
const pending: Factor = { id: secondId, factor_type: "totp", status: "unverified" };

function form(fields: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, value);
  return result;
}

function factors(all: Factor[]) {
  mocks.listFactors.mockResolvedValue({
    data: { all, totp: all.filter(item => item.factor_type === "totp" && item.status === "verified") }, error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now * 1000));
  mocks.context = {
    profile: { id: userId, role: "student", status: "active", data_scope: "operational", must_change_password: false } as Profile,
    aal: "aal1",
    session: { user: userId, session: "password-session", started: now - 60, seen: now },
  };
  mocks.requireProfile.mockResolvedValue(mocks.context.profile);
  mocks.consumeAttempt.mockResolvedValue(true);
  mocks.createClient.mockResolvedValue({ auth: {
    getClaims: mocks.claims, refreshSession: mocks.refresh,
    mfa: { listFactors: mocks.listFactors, enroll: mocks.enroll, unenroll: mocks.unenroll, challengeAndVerify: mocks.verify },
  } });
  factors([first]);
  mocks.enroll.mockResolvedValue({ data: { id: secondId, totp: { uri: "otpauth://totp/Test?secret=TESTONLY", secret: "TESTONLY" } }, error: null });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ data: { access_token: "must-not-return", refresh_token: "must-not-return" }, error: null });
  mocks.refresh.mockResolvedValue({ error: null });
  mocks.claims.mockResolvedValue({ data: { claims: { sub: userId, aal: "aal2", session_id: "verified-session" } }, error: null });
  mocks.signSession.mockReturnValue("signed-session");
});

afterEach(() => { vi.useRealTimers(); });

describe("MFA action identity and input boundary", () => {
  it.each([
    [enrollMfaAction, {}],
    [verifyMfaAction, { factor_id: firstId, code: "123456" }],
    [removeMfaAction, { factor_id: firstId }],
  ] as const)("authorizes every action before provider access %#", async (action, fields) => {
    mocks.requireProfile.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(action({}, form(fields))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
  });

  it("redirects when the signed identity context is absent", async () => {
    mocks.context = null;
    await expect(verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([enrollMfaAction, verifyMfaAction, removeMfaAction])("does not mutate shared demo authenticators %#", async (action) => {
    mocks.context!.profile.data_scope = "demo";
    expect((await action({}, form({ factor_id: firstId, code: "123456" }))).error).toBeTruthy();
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["12345", "1234567", "12x456", "000 00", ""])("rejects malformed OTP %j before provider calls", async (code) => {
    expect((await verifyMfaAction({}, form({ factor_id: firstId, code }))).error).toContain("six-digit");
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed factor IDs", async () => {
    expect((await verifyMfaAction({}, form({ factor_id: "not-a-factor", code: "123456" }))).error).toBeTruthy();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});

describe("MFA enrollment", () => {
  it("starts first-factor setup and returns only enrollment fields", async () => {
    factors([]);
    const result = await enrollMfaAction({}, form({ friendly_name: "  My phone  " }));
    expect(mocks.requireProfile).toHaveBeenCalledWith(undefined, { allowPasswordChange: true, allowMfaSetup: true });
    expect(mocks.consumeAttempt).toHaveBeenCalledWith(userId, "manage");
    expect(mocks.enroll).toHaveBeenCalledWith({ factorType: "totp", issuer: "LabTrack QR", friendlyName: "My phone" });
    expect(result).toEqual({ enrollment: { factorId: secondId, uri: "otpauth://totp/Test?secret=TESTONLY", secret: "TESTONLY" } });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("requires existing MFA before adding another authenticator", async () => {
    expect((await enrollMfaAction({}, form())).error).toContain("existing authenticator");
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("clears only owned pending TOTP entries after AAL2 authorization", async () => {
    mocks.context!.aal = "aal2";
    factors([first, pending, { id: foreignId, factor_type: "phone", status: "unverified" }]);
    expect((await enrollMfaAction({}, form({ friendly_name: "Backup" }))).enrollment).toBeTruthy();
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: secondId });
    expect(mocks.enroll).toHaveBeenCalled();
  });

  it("stops setup if pending-factor cleanup fails", async () => {
    factors([pending]);
    mocks.unenroll.mockResolvedValueOnce({ error: { message: "private provider detail" } });
    expect((await enrollMfaAction({}, form())).error).toContain("earlier setup");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it("does not contact the provider with an excessive device name", async () => {
    expect((await enrollMfaAction({}, form({ friendly_name: "x".repeat(61) }))).error).toContain("60");
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
  });

  it("fails closed if the management limit is exhausted", async () => {
    mocks.consumeAttempt.mockResolvedValueOnce(false);
    expect((await enrollMfaAction({}, form())).error).toContain("15 minutes");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("MFA code verification", () => {
  it.each([
    [[], foreignId],
    [[{ id: firstId, factor_type: "phone", status: "verified" }], firstId],
    [[first, pending], secondId],
  ] as const)("rejects foreign, unsupported, or premature factors %#", async (all, factorId) => {
    factors([...all]);
    expect((await verifyMfaAction({}, form({ factor_id: factorId, code: "123456" }))).error).toContain("linked to your account");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("allows initial pending-factor verification but not portal access before success", async () => {
    factors([pending]);
    mocks.verify.mockResolvedValueOnce({ error: { message: "private expired code detail" } });
    const result = await verifyMfaAction({}, form({ factor_id: secondId, code: "123456" }));
    expect(result.error).toContain("Code was not accepted");
    expect(JSON.stringify(result)).not.toContain("private expired");
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it.each([false, "throw"])("fails closed when the verification limit is unavailable: %s", async (mode) => {
    if (mode === "throw") mocks.consumeAttempt.mockRejectedValueOnce(new Error("private database detail"));
    else mocks.consumeAttempt.mockResolvedValueOnce(false);
    const result = await verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }));
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("private database");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("uses fresh provider claims, upgrades the cookie, and preserves the absolute start", async () => {
    await expect(verifyMfaAction({}, form({ factor_id: firstId, code: " 012345 " }))).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.consumeAttempt).toHaveBeenCalledWith(userId, "verify");
    expect(mocks.verify).toHaveBeenCalledWith({ factorId: firstId, code: "012345" });
    expect(mocks.claims).toHaveBeenCalledOnce();
    expect(mocks.signSession).toHaveBeenCalledWith({ user: userId, session: "verified-session", started: now - 60, seen: now });
    expect(mocks.setCookie).toHaveBeenCalledWith(SESSION_COOKIE, "signed-session", {
      httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: IDLE_SECONDS,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("caps the upgraded cookie at the original absolute deadline", async () => {
    mocks.context!.session.started = now - MAX_SESSION_SECONDS + 120;
    await expect(verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }))).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.setCookie.mock.calls[0][2].maxAge).toBe(120);
    expect(mocks.signSession.mock.calls[0][0].started).toBe(now - MAX_SESSION_SECONDS + 120);
  });

  it.each([
    [{ sub: foreignId, aal: "aal2", session_id: "session" }, null],
    [{ sub: userId, aal: "aal1", session_id: "session" }, null],
    [{ sub: userId, aal: "aal2" }, null],
    [{ sub: userId, aal: "aal2", session_id: "session" }, { message: "provider error" }],
  ])("rejects a mismatched or unverified provider session %#", async (claims, error) => {
    mocks.claims.mockResolvedValueOnce({ data: { claims }, error });
    expect((await verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }))).error).toContain("secure session");
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("does not extend an expired absolute session", async () => {
    mocks.context!.session.started = now - MAX_SESSION_SECONDS;
    expect((await verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }))).error).toContain("secure session");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("keeps a mandatory password change after successful MFA", async () => {
    mocks.context!.profile.must_change_password = true;
    await expect(verifyMfaAction({}, form({ factor_id: firstId, code: "123456" }))).rejects.toThrow("REDIRECT:/change-password");
  });

  it("allows AAL2 users to verify a backup and returns to device management", async () => {
    mocks.context!.aal = "aal2";
    factors([first, pending]);
    await expect(verifyMfaAction({}, form({ factor_id: secondId, code: "123456", manage: "1" }))).rejects.toThrow("REDIRECT:/two-factor?manage=1");
  });
});

describe("MFA device removal", () => {
  beforeEach(() => { mocks.context!.aal = "aal2"; factors([first, second]); });

  it.each(["aal1", undefined])("requires AAL2 to remove a device: %s", async (aal) => {
    mocks.context!.aal = aal;
    expect((await removeMfaAction({}, form({ factor_id: firstId }))).error).toContain("Verify your account");
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("blocks removal while a mandatory password change is unfinished", async () => {
    mocks.context!.profile.must_change_password = true;
    expect((await removeMfaAction({}, form({ factor_id: firstId }))).error).toContain("Verify your account");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("protects the last verified authenticator", async () => {
    factors([first, pending]);
    expect((await removeMfaAction({}, form({ factor_id: firstId }))).error).toContain("last device");
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("rejects a device not owned by the current user", async () => {
    expect((await removeMfaAction({}, form({ factor_id: foreignId }))).error).toContain("linked to your account");
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("refreshes after removal before trusting the previous AAL2 token", async () => {
    await expect(removeMfaAction({}, form({ factor_id: firstId }))).rejects.toThrow("REDIRECT:/two-factor?manage=1");
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: firstId });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.claims).toHaveBeenCalledOnce();
    expect(mocks.setCookie).toHaveBeenCalledOnce();
  });

  it.each(["error", "aal1", "throw"])("clears the app session if refresh cannot establish AAL2 after removal: %s", async (mode) => {
    if (mode === "error") mocks.refresh.mockResolvedValueOnce({ error: { message: "private refresh error" } });
    if (mode === "aal1") mocks.claims.mockResolvedValueOnce({ data: { claims: { sub: userId, aal: "aal1", session_id: "session" } }, error: null });
    if (mode === "throw") mocks.refresh.mockRejectedValueOnce(new Error("private refresh failure"));
    await expect(removeMfaAction({}, form({ factor_id: firstId }))).rejects.toThrow("REDIRECT:/login?message=Authenticator%20removed.");
    expect(mocks.deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("does not clear or refresh a session if removal itself fails", async () => {
    mocks.unenroll.mockResolvedValueOnce({ error: { message: "private remove error" } });
    const result = await removeMfaAction({}, form({ factor_id: firstId }));
    expect(result.error).toContain("could not be removed");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });
});
