import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Profile } from "@/types/app";
import { accessFailure } from "@/lib/access-policy";
import { apiRoute } from "@/lib/api";

const state = vi.hoisted(() => ({ profile: null as Profile | null, fail: false }));
vi.mock("@/lib/auth", () => ({ getProfile: async () => { if (state.fail) throw new Error("private database detail"); return state.profile; } }));
const profile = { id: "test", role: "custodian", status: "active", must_change_password: false, data_scope: "demo" } as Profile;
beforeEach(() => { state.profile = { ...profile }; state.fail = false; });

describe("authorization policy", () => {
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
