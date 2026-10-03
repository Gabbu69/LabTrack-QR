import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const fixture = vi.hoisted(() => ({ transactions: [] as Record<string, unknown>[], items: [] as Record<string, unknown>[], calls: 0, failAt: -1 }));
vi.mock("@/lib/records", () => ({
  historyQuery: () => {
    let cursor = "";
    const query = { lte: () => query, gt: (_key: string, value: string) => { cursor = value; return query; }, range: async (_from: number, to: number) => {
      fixture.calls++;
      if (fixture.calls === fixture.failAt) return { data: null, error: { message: "Unavailable" } };
      return { data: fixture.transactions.filter(transaction => String(transaction.id) > cursor).slice(0, to + 1), error: null };
    } };
    return query;
  },
  transactionItems: async (_client: unknown, ids: string[]) => fixture.items.filter(item => ids.includes(String(item.transaction_id))),
}));
import { loadHistoryReport } from "@/lib/history-report";
const client = {} as SupabaseClient<Database>;

describe("complete printable history", () => {
  it("includes records after the visible history page and counts missing tools as outstanding", async () => {
    fixture.calls = 0; fixture.failAt = -1;
    fixture.transactions = Array.from({ length: 501 }, (_, index) => ({ id: `tx-${String(index).padStart(5, "0")}`, borrowed_at: "2026-10-03T00:00:00Z" }));
    fixture.items = fixture.transactions.map((transaction, index) => ({ id: `item-${index}`, transaction_id: transaction.id, asset_code_snapshot: `ASSET-${index}`, item_status: index === 0 ? "missing" : index === 500 ? "borrowed" : "returned" }));
    const report = await loadHistoryReport(client, { page: "99" });
    expect(report.transactions).toHaveLength(501);
    expect(report.byTransaction.get("tx-00500")?.[0].asset_code_snapshot).toBe("ASSET-500");
    expect(report.totals).toEqual({ transactions: 501, items: 501, outstanding: 2, missing: 1, returned: 499 });
  });
  it("fails the report instead of returning an apparently complete partial result", async () => {
    fixture.calls = 0; fixture.failAt = 2;
    fixture.transactions = Array.from({ length: 501 }, (_, index) => ({ id: `tx-${String(index).padStart(5, "0")}`, borrowed_at: "2026-10-03T00:00:00Z" }));
    await expect(loadHistoryReport(client, {})).rejects.toThrow("report could not be loaded");
  });
  it("rejects an impossible date before requesting records", async () => {
    fixture.calls = 0; fixture.failAt = -1;
    await expect(loadHistoryReport(client, { from: "2026-02-30" })).rejects.toThrow("valid calendar date");
    expect(fixture.calls).toBe(0);
  });
});
