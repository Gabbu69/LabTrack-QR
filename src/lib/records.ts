import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Transaction, TransactionItem, TransactionStatus } from "@/types/app";
import { containsPattern, parseHistoryFilters, type SearchParams } from "@/lib/query-filters";

export function historyQuery(client: SupabaseClient<Database>, params: SearchParams, exportOrder = false) {
  const filters = parseHistoryFilters(params);
  // Reports traverse every page; recounting all matches for each batch is wasted work.
  let query = client.from("transactions").select("*", exportOrder ? undefined : { count: "exact" });
  query = exportOrder ? query.order("id") : query.order("borrowed_at", { ascending: false }).order("id");
  if (filters.status === "active") query = query.neq("status", "returned");
  else if (filters.status) query = query.eq("status", filters.status as TransactionStatus);
  if (filters.from) query = query.gte("borrowed_at", filters.from);
  if (filters.until) query = query.lt("borrowed_at", filters.until);
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.q) ? `,id.eq.${filters.q}` : "";
    query = query.or(`borrower_name_snapshot.ilike.${pattern},borrower_student_id_snapshot.ilike.${pattern}${id}`);
  }
  return query;
}

export async function transactionItems(client: SupabaseClient<Database>, ids: string[]) {
  const items: TransactionItem[] = [];
  // Overlap at most four independent ID batches. Paginate each batch completely
  // and preserve input order, including when requests finish out of order.
  for (let batch = 0; batch < ids.length; batch += 200) {
    const chunks: string[][] = [];
    for (let chunk = batch; chunk < Math.min(batch + 200, ids.length); chunk += 50) chunks.push(ids.slice(chunk, chunk + 50));
    const results = await Promise.all(chunks.map(async (chunkIds) => {
      const rows: TransactionItem[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from("transaction_items").select("*").in("transaction_id", chunkIds).order("id").range(offset, offset + 499);
        if (error) throw new Error("Transaction items could not be loaded. Please try again.");
        rows.push(...data);
        if (data.length < 500) break;
      }
      return rows;
    }));
    for (const rows of results) items.push(...rows);
  }
  return items;
}

export async function outstandingTransactions(client: SupabaseClient<Database>, borrowerId: string) {
  const transactions: Transaction[] = [];
  for (let offset = 0; ; offset += 250) {
    const { data, error } = await client.from("transactions").select("*").eq("borrower_id", borrowerId)
      .neq("status", "returned").order("borrowed_at", { ascending: false }).order("id").range(offset, offset + 249);
    if (error) throw new Error("Custody records could not be loaded. Please try again.");
    transactions.push(...data);
    if (data.length < 250) break;
  }
  return transactions;
}
