import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Profile, Tool } from "@/types/app";

const state = vi.hoisted(() => ({ profile: null as Profile | null, aal: "aal2", rows: [] as Partial<Tool>[], calls: 0, failAt: -1, removeFirst: false }));
vi.mock("@/lib/auth", () => ({ getAuthContext: async () => state.profile ? { profile: state.profile, aal: state.aal } : null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => {
  let cursor = "";
  const filters: Record<string, string> = {};
  const query = {
    select: () => query, order: () => query, lte: () => query, or: () => query,
    eq: (key: string, value: string) => { filters[key] = value; return query; },
    gt: (_key: string, value: string) => { cursor = value; return query; },
    range: async (from: number, to: number) => {
      state.calls++;
      if (state.calls === state.failAt) return { data: null, error: { code: "network" } };
      if (state.calls === 2 && state.removeFirst) state.rows.shift();
      return { data: state.rows.filter(row => String(row.id) > cursor && Object.entries(filters).every(([key, value]) => row[key as keyof Tool] === value)).slice(from, to + 1), error: null };
    },
  };
  return query;
} }) }));

import { GET } from "@/app/api/reports/inventory.csv/route";
import { parseInventoryFilters } from "@/lib/inventory";
const download = (query = "") => GET(new NextRequest(`https://labtrack.test/api/reports/inventory.csv${query}`));

beforeEach(() => {
  state.profile = { id: "staff", role: "custodian", status: "active", data_scope: "operational", must_change_password: false } as Profile;
  state.aal = "aal2"; state.calls = 0; state.failAt = -1; state.removeFirst = false;
  state.rows = Array.from({ length: 1251 }, (_, index) => ({ id: `tool-${String(index).padStart(5, "0")}`, asset_code: `ASSET-${index}`, tool_name: "Torque wrench", category: index % 2 ? "Hand tools" : "Measuring", condition: "good", status: index % 2 ? "available" : "missing", description: "" }));
});

it("exports beyond the database row cap and ignores the screen's page number", async () => {
  const response = await download("?page=9");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("labtrack-inventory-");
  const csv = await response.text();
  expect(csv.split("\r\n")).toHaveLength(1252);
  expect(csv).toContain("ASSET-1250");
  expect(csv).not.toContain("qr_token");
});

it("uses status and category together for the entire filtered download", async () => {
  const csv = await (await download("?status=available&category=Hand+tools")).text();
  expect(csv.split("\r\n")).toHaveLength(626);
  expect(csv).not.toContain(",missing,");
  expect(csv).not.toContain(",Measuring,");
});

it("returns an error without exposing a partial CSV if a later batch fails", async () => {
  state.failAt = 3;
  const response = await download();
  expect(response.status).toBe(503);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.text()).not.toContain("ASSET-");
});

it("does not skip the next tool if an earlier exported tool disappears", async () => {
  state.removeFirst = true;
  const csv = await (await download()).text();
  expect(csv.split("\r\n")).toHaveLength(1252);
  expect(csv).toContain("ASSET-250,");
});

it("neutralizes spreadsheet formulas in editable tool fields", async () => {
  state.rows = [{ ...state.rows[0], tool_name: '=HYPERLINK("https://invalid.test")' }];
  expect(await (await download()).text()).toContain('"\'=HYPERLINK(""https://invalid.test"")"');
});

it.each(["student", "anonymous", "password-only", "pending", "disabled", "temporary-password"])("denies %s inventory exports before reading tools", async mode => {
  if (mode === "student") state.profile!.role = "student";
  if (mode === "anonymous") state.profile = null;
  if (mode === "password-only") state.aal = "aal1";
  if (mode === "pending" || mode === "disabled") state.profile!.status = mode;
  if (mode === "temporary-password") state.profile!.must_change_password = true;
  expect((await download()).status).toBe(mode === "anonymous" ? 401 : 403);
  expect(state.calls).toBe(0);
});

it("permits verified instructors to export their visible inventory", async () => {
  state.profile!.role = "instructor";
  expect((await download()).status).toBe(200);
});

it.each(["?status=unknown", `?q=${"x".repeat(121)}`, `?category=${"x".repeat(121)}`])("rejects invalid filters before database access: %s", async query => {
  expect((await download(query)).status).toBe(400);
  expect(state.calls).toBe(0);
});

it("normalizes inventory search and category whitespace", () => {
  expect(parseInventoryFilters({ q: "  wrench  ", category: "  Hand tools  " })).toEqual({ q: "wrench", category: "Hand tools", status: "" });
});
