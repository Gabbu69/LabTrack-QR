import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ mutate: false, failAt: -1, offsets: [] as number[], transactions: [] as Record<string, unknown>[], items: [] as Record<string, unknown>[] }));
vi.mock("@/lib/auth", () => ({ getProfile: async () => ({ id: "actor", role: "custodian", status: "active", must_change_password: false }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => {
  let ids: string[] | undefined; let cursor = "";
  const query = { select: () => query, order: () => query, lte: () => query, gt: (_field: string, value: string) => { cursor = value; return query; }, in: (_field: string, values: string[]) => { ids = values; return query; }, range: async (from: number, to: number) => {
    if (table === "transactions") { if (state.mutate && state.offsets.length === 1) state.transactions.splice(0, 1); state.offsets.push(from); if (state.offsets.length === state.failAt) return { data: null, error: { code: "network" } }; }
    const rows = table === "transactions" ? state.transactions.filter(tx => String(tx.id) > cursor) : state.items.filter((item) => ids?.includes(String(item.transaction_id)));
    return { data: rows.slice(from, to + 1), error: null };
  } }; return query;
} }) }));
import { GET } from "@/app/api/reports/transactions.csv/route";
beforeEach(() => {
  state.mutate = false; state.failAt = -1; state.offsets = [];
  state.transactions = Array.from({ length: 5105 }, (_, id) => ({ id: `tx-${String(id).padStart(5,"0")}`, borrowed_at: "2026-09-25T00:00:00Z", borrower_name_snapshot: "Test Borrower", borrower_student_id_snapshot: "ST-1", status: "returned" }));
  state.items = state.transactions.map((tx, id) => ({ id, transaction_id: tx.id, asset_code_snapshot: `ASSET-${id}`, tool_name_snapshot: "Tool", item_status: "returned" }));
  state.items.push(...Array.from({ length: 1207 }, (_, id) => ({ id: 6000 + id, transaction_id: "tx-00000", asset_code_snapshot: `EXTRA-${id}`, tool_name_snapshot: "Tool", item_status: "returned" })));
});
it("exports every matching row beyond 5000 transactions and 1000 nested items", async () => {
  const response = await GET(new NextRequest("https://labtrack.test/api/reports/transactions.csv?page=99"));
  expect(response.status).toBe(200); const csv = await response.text();
  expect(csv.split("\r\n")).toHaveLength(5105 + 1207 + 1);
  expect(csv).toContain("ASSET-5104"); expect(csv).toContain("EXTRA-1206"); expect(state.offsets).toHaveLength(21);
});
it("returns an error instead of a successful truncated download if a later batch fails", async () => {
  state.failAt = 3; const response = await GET(new NextRequest("https://labtrack.test/api/reports/transactions.csv"));
  expect(response.status).toBe(503); expect(response.headers.get("content-type")).toContain("application/json"); expect(await response.text()).not.toContain("ASSET-");
});
it("rejects impossible dates before querying the database", async () => {
  const response = await GET(new NextRequest("https://labtrack.test/api/reports/transactions.csv?from=2026-02-30"));
  expect(response.status).toBe(400); expect(state.offsets).toHaveLength(0);
});

it("does not skip an unexported row when an earlier matching transaction changes status", async () => {
 state.mutate = true;
 const response = await GET(new NextRequest("https://labtrack.test/api/reports/transactions.csv"));
 expect(response.status).toBe(200); expect((await response.text()).split("\r\n")).toHaveLength(6313);
});
