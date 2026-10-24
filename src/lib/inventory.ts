import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ToolStatus } from "@/types/app";
import { containsPattern, TOOL_STATUSES, type SearchParams } from "@/lib/query-filters";

export function parseInventoryFilters(params: SearchParams) {
  const q = (params.q ?? "").trim();
  const category = (params.category ?? "").trim();
  const status = params.status ?? "";
  if (q.length > 120 || category.length > 120) throw new Error("Keep searches and categories to 120 characters or fewer.");
  if (status && !TOOL_STATUSES.some(value => value === status)) throw new Error("Choose a valid tool status.");
  return { q, category, status: status as ToolStatus | "" };
}

// The screen and download use the same filters and the caller's RLS-scoped client.
export function inventoryQuery(client: SupabaseClient<Database>, params: SearchParams, exportOrder = false) {
  const filters = parseInventoryFilters(params);
  let query = client.from("tools").select("*", { count: "exact" });
  query = exportOrder ? query.order("id") : query.order("asset_code").order("id");
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    query = query.or(`asset_code.ilike.${pattern},tool_name.ilike.${pattern},category.ilike.${pattern}`);
  }
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
  return query;
}
