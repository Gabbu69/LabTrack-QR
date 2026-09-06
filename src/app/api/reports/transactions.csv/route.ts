import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionItem } from "@/types/app";

export async function GET(request: NextRequest) {
  const profile = await requireProfile(); const supabase = await createClient(); const filters = request.nextUrl.searchParams;
  let query = supabase.from("transactions").select("*").order("borrowed_at", { ascending: false }).limit(5000);
  if (profile.role === "student") query = query.eq("borrower_id", profile.id);
  const status = filters.get("status");
  if (status === "active") query = query.neq("status", "returned"); else if (status && ["borrowed","partial","incomplete","returned"].includes(status)) query = query.eq("status", status as Transaction["status"]);
  const from = filters.get("from"); const to = filters.get("to");
  if (from) query = query.gte("borrowed_at", `${from}T00:00:00`); if (to) query = query.lte("borrowed_at", `${to}T23:59:59.999`);
  const { data, error } = await query; if (error) return NextResponse.json({ error: "Report could not be generated." }, { status: 500 });
  let transactions = (data ?? []) as Transaction[]; const needle = (filters.get("q") ?? filters.get("student") ?? "").trim().toLowerCase();
  if (needle) transactions = transactions.filter((transaction) => `${transaction.borrower_name_snapshot} ${transaction.borrower_student_id_snapshot} ${transaction.id}`.toLowerCase().includes(needle));
  const ids = transactions.map((transaction) => transaction.id); const { data: itemData, error: itemError } = ids.length ? await supabase.from("transaction_items").select("*").in("transaction_id", ids) : { data: [], error: null };
  if (itemError) return NextResponse.json({ error: "Report items could not be loaded. Try exporting again." }, { status: 503 });
  const items = (itemData ?? []) as TransactionItem[]; const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const csv = toCsv(["Transaction ID","Borrower","Student ID","Year/Section","Group","Date Borrowed","Date Returned","Transaction Status","Asset Code","Tool","Item Status","Issue Condition","Return Condition","Return Note","Missing At","Missing Note"], items.map((item) => { const tx = transactionMap.get(item.transaction_id); return [tx?.id,tx?.borrower_name_snapshot,tx?.borrower_student_id_snapshot,tx?.borrower_year_section_snapshot,tx?.borrower_group_snapshot,tx?.borrowed_at,tx?.completed_at,tx?.status,item.asset_code_snapshot,item.tool_name_snapshot,item.item_status,item.issue_condition,item.return_condition,item.return_note,item.missing_at,item.missing_note]; }));
  return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="labtrack-history-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
}
