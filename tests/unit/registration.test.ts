import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ result: { data: null as object | null, error: null as object | null }, calls: [] as unknown[][] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => {
  state.calls.push(["from", table]);
  const query = Object.fromEntries(["select", "eq", "neq", "ilike", "limit"].map(name => [name, (...args: unknown[]) => { state.calls.push([name, ...args]); return query; }])) as Record<string, (...args: unknown[]) => unknown>;
  query.maybeSingle = async () => state.result;
  return query;
} }) }));
import { studentIdInUse } from "@/lib/registration";
import { registrationErrorMessage, signInErrorMessage } from "@/lib/auth-errors";
afterEach(() => { state.calls = []; state.result = { data: null, error: null }; });

it("checks operational active and pending accounts while escaping literal ID wildcards", async () => {
  state.result.data = { id: "existing" };
  expect(await studentIdInUse("  S_1%  ")).toBe(true);
  expect(state.calls).toContainEqual(["eq", "data_scope", "operational"]);
  expect(state.calls).toContainEqual(["neq", "status", "disabled"]);
  expect(state.calls).toContainEqual(["ilike", "student_id", "S\\_1\\%"]);
  expect(state.calls).toContainEqual(["select", "id"]);
});
it("does not treat a failed query as an available ID", async () => {
  state.result.error = {};
  await expect(studentIdInUse("S1")).rejects.toThrow(/could not be checked/);
});
it("distinguishes provider outages and rate limits from incorrect credentials", () => {
  expect(signInErrorMessage({ status: 500 })).toMatch(/temporarily unavailable/);
  expect(signInErrorMessage({ status: 429 })).toMatch(/Wait/);
  expect(signInErrorMessage({ code: "invalid_credentials" })).toMatch(/Email or password/);
  expect(signInErrorMessage({ code: "email_not_confirmed" })).toMatch(/Confirm your email/);
});
it("maps registration failures without exposing provider diagnostics", () => {
  expect(registrationErrorMessage({ code: "email_exists" })).toMatch(/Sign in/);
  expect(registrationErrorMessage({ code: "weak_password" })).toMatch(/stronger password/);
  expect(registrationErrorMessage({ code: "over_request_rate_limit" })).toMatch(/Wait/);
  expect(registrationErrorMessage({ status: 500, message: "private constraint details" })).not.toMatch(/private constraint/);
});
