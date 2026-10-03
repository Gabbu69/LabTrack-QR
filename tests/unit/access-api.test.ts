import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Profile } from "@/types/app";
import { accessFailure } from "@/lib/access-policy";
import { apiRoute } from "@/lib/api";

const state = vi.hoisted(() => ({ profile: null as Profile | null, fail: false, aal: "aal2" as string | undefined }));
vi.mock("@/lib/auth", () => ({ getAuthContext: async () => { if (state.fail) throw new Error("private database detail"); return state.profile ? { profile: state.profile, aal: state.aal } : null; } }));
const profile = { id: "test", role: "custodian", status: "active", must_change_password: false, data_scope: "demo" } as Profile;
beforeEach(() => { state.profile = { ...profile }; state.fail = false; state.aal = "aal2"; });

describe("authorization policy", () => {
  it("denies unrecognized role and status values", () => {
    expect(accessFailure({ ...profile, role: "admin" } as unknown as Profile)?.code).toBe("ACCESS_DENIED");
    expect(accessFailure({ ...profile, status: "unknown" } as unknown as Profile)?.code).toBe("ACCESS_DENIED");
  });
  it.each([
    [null, "AUTH_REQUIRED"], [{ ...profile, status: "disabled" }, "ACCOUNT_DISABLED"],
    [{ ...profile, status: "pending" }, "APPROVAL_REQUIRED"], [{ ...profile, must_change_password: true }, "PASSWORD_CHANGE_REQUIRED"],
    [{ ...profile, role: "student" }, "ACCESS_DENIED"], [{ ...profile, role: "instructor" }, "ACCESS_DENIED"],
  ] as const)("rejects restricted profile %#", (candidate, code) => {
    expect(accessFailure(candidate as Profile | null, { active: true, roles: ["custodian"] })?.code).toBe(code);
  });
  it("allows pending students to see their approval page but no active operations", () => {
    expect(accessFailure({ ...profile, role: "student", status: "pending" })).toBeNull();
  });
  it("allows changing a temporary password without granting portal access", () => {
    const temporary = { ...profile, must_change_password: true };
    expect(accessFailure(temporary, { allowPasswordChange: true })).toBeNull();
    expect(accessFailure(temporary)?.status).toBe(403);
  });
  it.each(["student", "instructor", "custodian"] as const)("requires verified MFA for operational %s accounts", role => {
    const real = { ...profile, role, data_scope: "operational" as const };
    expect(accessFailure(real, {}, "aal1")?.code).toBe("MFA_REQUIRED");
    expect(accessFailure(real)?.code).toBe("MFA_REQUIRED");
    expect(accessFailure(real, {}, "aal2")).toBeNull();
    expect(accessFailure({ ...real, must_change_password: true }, { allowPasswordChange: true }, "aal1")?.code).toBe("MFA_REQUIRED");
  });
  it("allows only the limited MFA setup context before verification", () => {
    const real = { ...profile, data_scope: "operational" as const, must_change_password: true };
    expect(accessFailure(real, { allowMfaSetup: true }, "aal1")?.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(accessFailure(real, { allowMfaSetup: true, allowPasswordChange: true }, "aal1")).toBeNull();
    expect(accessFailure({ ...real, status: "disabled" }, { allowMfaSetup: true, allowPasswordChange: true }, "aal1")?.code).toBe("ACCOUNT_DISABLED");
  });
  it("exempts only trusted demo scope, not a missing scope or invented AAL", () => {
    expect(accessFailure(profile, {}, "aal1")).toBeNull();
    expect(accessFailure({ ...profile, data_scope: undefined } as unknown as Profile, {}, "aal1")?.code).toBe("MFA_REQUIRED");
    expect(accessFailure({ ...profile, data_scope: "operational" }, {}, "aal3")?.code).toBe("MFA_REQUIRED");
  });
});

describe("API boundary", () => {
  const request = () => new NextRequest("https://labtrack.test/api/borrow", { method: "POST", headers: { origin: "https://labtrack.test" } });
  it.each([[null, 401], [{ ...profile, role: "student" }, 403], [{ ...profile, must_change_password: true }, 403]] as const)("returns JSON without running unauthorized writes %#", async (candidate, status) => {
    state.profile = candidate as Profile | null;
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await apiRoute({ roles: ["custodian"], active: true }, handler)(request());
    expect(response.status).toBe(status); expect(response.headers.get("content-type")).toContain("application/json");
    expect(handler).not.toHaveBeenCalled(); expect(response.headers.get("location")).toBeNull();
  });
  it("blocks cross-origin mutations", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await apiRoute({}, handler)(new NextRequest("https://labtrack.test/api/borrow", { method: "POST", headers: { origin: "https://unrelated.test" } }));
    expect(response.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it.each(["GET", "POST"])("denies password-only operational %s requests before the handler", async method => {
    state.profile = { ...profile, data_scope: "operational" }; state.aal = "aal1";
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await apiRoute({ allowPasswordChange: true }, handler)(new NextRequest("https://labtrack.test/api/session", { method }));
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ code: "MFA_REQUIRED" });
    expect(handler).not.toHaveBeenCalled(); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps successful responses private", async () => {
    const response = await apiRoute({}, async () => Response.json({ transactionId: "tx" }))(request());
    expect(await response.json()).toEqual({ transactionId: "tx" }); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not expose database exception text", async () => {
    state.fail = true;
    const response = await apiRoute({}, async () => Response.json({}))(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private database detail");
  });
});
