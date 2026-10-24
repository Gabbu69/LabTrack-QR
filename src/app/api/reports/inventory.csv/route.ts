import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { inventoryQuery, parseInventoryFilters } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

export const GET = apiRoute({ active: true, roles: ["custodian", "instructor"] }, async request => {
  const filters = Object.fromEntries(request.nextUrl.searchParams);
  try { parseInventoryFilters(filters); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Check the inventory filters." }, { status: 400 }); }
  const client = await createClient();
  const startedAt = new Date().toISOString();
  const chunks = ["\uFEFF" + toCsv(["Asset Code", "Tool", "Category", "Condition", "Status", "Description"], [])];
  let cursor: string | undefined;
  for (;;) {
    let query = inventoryQuery(client, filters, true).lte("created_at", startedAt);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query.range(0, 249);
    if (error) return NextResponse.json({ error: "Inventory export could not be completed. Please try again." }, { status: 503 });
    if (data.length) chunks.push(toCsv([], data.map(tool => [tool.asset_code, tool.tool_name, tool.category, tool.condition, tool.status, tool.description])).slice(2));
    if (data.length < 250) break;
    cursor = data[data.length - 1].id;
  }
  return new NextResponse(chunks.join("\r\n"), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="labtrack-inventory-' + new Date().toISOString().slice(0, 10) + '.csv"',
  } });
});
