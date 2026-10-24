import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { historyQuery, transactionItems } from "@/lib/records";

it("overlaps at most four item batches, preserves order, and reads beyond 500 rows", async () => {
  let active = 0;
  let peak = 0;
  const requests: string[][] = [];
  const client = { from: () => {
    let ids: string[] = [];
    const query = { select: () => query, in: (_key: string, values: string[]) => { ids = values; return query; }, order: () => query,
      range: async (from: number, to: number) => {
        active++; peak = Math.max(peak, active); requests.push(ids);
        // Complete later batches first to verify stable assembly order.
        await new Promise(resolve => setTimeout(resolve, ids[0] === "tx-0" ? 10 : 1));
        active--;
        const rows = ids.flatMap(id => Array.from({ length: id === "tx-0" ? 1201 : 1 }, (_, i) => ({ id: `${id}-${i}`, transaction_id: id })));
        return { data: rows.slice(from, to + 1), error: null };
      } };
    return query;
  } } as unknown as SupabaseClient<Database>;
  const ids = Array.from({ length: 251 }, (_, i) => `tx-${i}`);
  const items = await transactionItems(client, ids);
  expect(peak).toBe(4);
  expect(items).toHaveLength(1451);
  expect(items[0].id).toBe("tx-0-0");
  expect(items[1200].id).toBe("tx-0-1200");
  expect(items.at(-1)?.transaction_id).toBe("tx-250");
  expect(requests.every(batch => batch.length <= 50)).toBe(true);
});

it("rejects a failed later item page instead of returning a truncated result", async () => {
  const query = { select: () => query, in: () => query, order: () => query,
    range: vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ id: "item" })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private detail" } }) };
  const client = { from: () => query } as unknown as SupabaseClient<Database>;
  await expect(transactionItems(client, ["tx"])).rejects.toThrow("Transaction items could not be loaded");
});

it("does not query empty item batches or request repeated exact counts for full reports", async () => {
  const select = vi.fn();
  const query = { select, order: () => query };
  select.mockReturnValue(query);
  const from = vi.fn(() => query);
  const client = { from } as unknown as SupabaseClient<Database>;
  expect(await transactionItems(client, [])).toEqual([]);
  expect(from).not.toHaveBeenCalled();
  historyQuery(client, {});
  expect(select).toHaveBeenLastCalledWith("*", { count: "exact" });
  historyQuery(client, {}, true);
  expect(select).toHaveBeenLastCalledWith("*", undefined);
});
