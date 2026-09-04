import Link from "next/link";
import { Download, History, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionItem } from "@/types/app";

export const metadata = { title: "History & Reports" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; student?: string; status?: string; from?: string; to?: string }> }) {
  const profile = await requireProfile(); const filters = await searchParams; const supabase = await createClient();
  let request = supabase.from("transactions").select("*").order("borrowed_at", { ascending: false }).limit(1000);
  if (profile.role === "student") request = request.eq("borrower_id", profile.id);
  if (filters.status === "active") request = request.neq("status", "returned"); else if (filters.status) request = request.eq("status", filters.status as Transaction["status"]);
  if (filters.from) request = request.gte("borrowed_at", `${filters.from}T00:00:00`);
  if (filters.to) request = request.lte("borrowed_at", `${filters.to}T23:59:59.999`);
  const { data } = await request; let transactions = (data ?? []) as Transaction[];
  const needle = (filters.q ?? filters.student ?? "").trim().toLowerCase();
  if (needle) transactions = transactions.filter((transaction) => `${transaction.borrower_name_snapshot} ${transaction.borrower_student_id_snapshot} ${transaction.id}`.toLowerCase().includes(needle));
  const ids = transactions.map((transaction) => transaction.id);
  const { data: itemData } = ids.length ? await supabase.from("transaction_items").select("*").in("transaction_id", ids).order("asset_code_snapshot") : { data: [] };
  const items = (itemData ?? []) as TransactionItem[];
  const exportParams = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) exportParams.set(key, value); });
  return <div className="page-wrap"><PageHeader eyebrow={profile.role === "student" ? "PERSONAL RECORD" : "REPORTING"} title={profile.role === "student" ? "BORROWING HISTORY" : "HISTORY & REPORTS"} description={profile.role === "student" ? "Your borrowing and return records." : "Search borrowing records, borrower details, returns, and missing items."} actions={<Link className="button button-secondary" href={`/api/reports/transactions.csv?${exportParams}`}><Download aria-hidden="true" />Export CSV</Link>} />
    <section className="content-card"><form className="filter-bar" action="/history"><label className="search-field"><Search aria-hidden="true" /><input name="q" defaultValue={filters.q ?? filters.student} placeholder="Search borrower, student ID, or transaction" /></label><select name="status" defaultValue={filters.status ?? ""} aria-label="Filter by transaction status"><option value="">All statuses</option><option value="active">Any active</option>{["borrowed","partial","incomplete","returned"].map((status) => <option key={status}>{status}</option>)}</select><label className="date-filter"><span>From</span><input name="from" type="date" defaultValue={filters.from} /></label><label className="date-filter"><span>To</span><input name="to" type="date" defaultValue={filters.to} /></label><button className="button button-secondary" type="submit">Apply</button></form>
      {transactions.length === 0 ? <div className="empty-state"><History aria-hidden="true" /><h2>No matching transactions</h2><p>Completed and active borrowing records will appear here.</p></div> : <div className="transaction-list">{transactions.map((transaction) => { const txItems = items.filter((item) => item.transaction_id === transaction.id); return <details className="transaction-row" key={transaction.id}><summary><span><strong>{transaction.borrower_name_snapshot}</strong><small>{transaction.borrower_student_id_snapshot} · {new Date(transaction.borrowed_at).toLocaleString("en-PH")}</small></span><span className="transaction-summary"><b>{txItems.length} {txItems.length === 1 ? "tool" : "tools"}</b><StatusBadge value={transaction.status} /></span></summary><div className="transaction-detail"><dl><div><dt>Transaction</dt><dd className="mono">{transaction.id}</dd></div><div><dt>Year / Section</dt><dd>{transaction.borrower_year_section_snapshot ?? "—"}</dd></div><div><dt>Group</dt><dd>{transaction.borrower_group_snapshot ?? "—"}</dd></div><div><dt>Completed</dt><dd>{transaction.completed_at ? new Date(transaction.completed_at).toLocaleString("en-PH") : "Outstanding"}</dd></div></dl><div className="table-wrap"><table><thead><tr><th>Asset</th><th>Tool</th><th>Status</th><th>Returned condition</th><th>Note</th></tr></thead><tbody>{txItems.map((item) => <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td><StatusBadge value={item.item_status} /></td><td>{item.return_condition ? <StatusBadge value={item.return_condition} /> : "—"}</td><td>{item.return_note ?? item.missing_note ?? "—"}</td></tr>)}</tbody></table></div></div></details>; })}</div>}
    </section>
  </div>;
}
