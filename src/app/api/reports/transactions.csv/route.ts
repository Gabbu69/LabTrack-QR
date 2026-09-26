import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { historyQuery, transactionItems } from "@/lib/records";
import { parseHistoryFilters } from "@/lib/query-filters";

export const GET = apiRoute({ active: true }, async (request) => {
  const filters = Object.fromEntries(request.nextUrl.searchParams);
  try { parseHistoryFilters(filters); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid report filters." }, { status: 400 }); }
  const client = await createClient();
  const columns = ["Transaction ID","Borrower","Student ID","Year/Section","Group","Date Borrowed","Date Returned","Transaction Status","Asset Code","Tool","Item Status","Issue Condition","Return Condition","Return Note","Missing At","Missing Note"];
  const chunks = ["\uFEFF" + toCsv(columns, [])];
  // Do not return a successful download unless every batch succeeds.
  const startedAt = new Date().toISOString();
  let cursor: string | undefined;
  for (;;) {
    let query = historyQuery(client, filters, true).lte("created_at", startedAt);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query.range(0, 249);
    if (error) return NextResponse.json({ error: "Report could not be generated. Try again." }, { status: 503 });
    const map = new Map(data.map((tx) => [tx.id, tx]));
    const items = await transactionItems(client, data.map((tx) => tx.id));
    items.sort((a, b) => (map.get(b.transaction_id)?.borrowed_at ?? "").localeCompare(map.get(a.transaction_id)?.borrowed_at ?? "") || a.asset_code_snapshot.localeCompare(b.asset_code_snapshot));
    const rows = items.map((item) => {
      const tx = map.get(item.transaction_id)!;
      return [tx.id,tx.borrower_name_snapshot,tx.borrower_student_id_snapshot,tx.borrower_year_section_snapshot,tx.borrower_group_snapshot,tx.borrowed_at,tx.completed_at,tx.status,item.asset_code_snapshot,item.tool_name_snapshot,item.item_status,item.issue_condition,item.return_condition,item.return_note,item.missing_at,item.missing_note];
    });
    if (rows.length) chunks.push(toCsv([], rows).slice(2));
    if (data.length < 250) break;
    cursor = data[data.length - 1].id;
  }
  return new NextResponse(chunks.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="labtrack-history-' + new Date().toISOString().slice(0, 10) + '.csv"' } });
});
