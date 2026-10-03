import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Transaction, TransactionItem } from "@/types/app";
import { historyQuery, transactionItems } from "@/lib/records";
import { parseHistoryFilters, type SearchParams } from "@/lib/query-filters";

export async function loadHistoryReport(client: SupabaseClient<Database>, filters: SearchParams) {
  parseHistoryFilters(filters);
  const generatedAt = new Date().toISOString();
  const transactions: Transaction[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = historyQuery(client, filters, true).lte("created_at", generatedAt);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query.range(0, 249);
    if (error) throw new Error("The report could not be loaded. Please try again.");
    transactions.push(...data);
    if (data.length < 250) break;
    cursor = data[data.length - 1].id;
  }
  transactions.sort((a, b) => b.borrowed_at.localeCompare(a.borrowed_at) || a.id.localeCompare(b.id));
  const items = await transactionItems(client, transactions.map(transaction => transaction.id));
  const byTransaction = new Map<string, TransactionItem[]>();
  for (const item of items) {
    const group = byTransaction.get(item.transaction_id) ?? [];
    group.push(item);
    byTransaction.set(item.transaction_id, group);
  }
  for (const group of byTransaction.values()) group.sort((a, b) => a.asset_code_snapshot.localeCompare(b.asset_code_snapshot));
  return {
    transactions, byTransaction, generatedAt,
    totals: {
      transactions: transactions.length,
      items: items.length,
      outstanding: items.filter(item => item.item_status !== "returned").length,
      returned: items.filter(item => item.item_status === "returned").length,
      missing: items.filter(item => item.item_status === "missing").length,
    },
  };
}
