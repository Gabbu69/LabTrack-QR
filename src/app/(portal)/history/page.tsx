import { Download, History, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/ui/pagination";
import { Notice } from "@/components/feedback/notice";
import { historyQuery, transactionItems } from "@/lib/records";
import { PAGE_SIZE, pageNumber, parseHistoryFilters, formatLabDate } from "@/lib/query-filters";
import { redirect } from "next/navigation";
import { pageHref } from "@/lib/query-filters";
import type { Transaction, TransactionItem } from "@/types/app";

export const metadata = { title: "History & Reports" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; student?: string; status?: string; from?: string; to?: string; page?: string }> }) {
  const profile = await requireProfile(); const filters = await searchParams; const supabase = await createClient();
  const page = pageNumber(filters.page);
  let filterError = "";
  try { parseHistoryFilters(filters); } catch (error) { filterError = error instanceof Error ? error.message : "Invalid filters."; }
  let transactions: Transaction[] = []; let items: TransactionItem[] = []; let count = 0;
  if (!filterError) {
    const result = await historyQuery(supabase, filters).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) throw new Error("History could not be loaded. Please try again.");
    count = result.count ?? 0;
    const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (page > lastPage) redirect(pageHref("/history", filters, lastPage));
    transactions = result.data;
    items = await transactionItems(supabase, transactions.map((tx) => tx.id));
  }
  const itemsByTransaction = new Map<string, TransactionItem[]>();
  items.forEach((item) => itemsByTransaction.set(item.transaction_id, [...(itemsByTransaction.get(item.transaction_id) ?? []), item]));
  const exportParams = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) exportParams.set(key, value); });
  return <div className="page-wrap"><PageHeader eyebrow={profile.role === "student" ? "PERSONAL RECORD" : "REPORTING"} title={profile.role === "student" ? "BORROWING HISTORY" : "HISTORY & REPORTS"} description={profile.role === "student" ? "Your borrowing and return records." : "Search borrowing records, borrower details, returns, and missing items."} actions={<a className="button button-secondary" download href={`/api/reports/transactions.csv?${exportParams}`}><Download aria-hidden="true" />Export CSV</a>} />
    <Notice error={filterError} /><section className="content-card"><form className="filter-bar" action="/history"><label className="search-field"><Search aria-hidden="true" /><input aria-label="Search history" maxLength={120} name="q" defaultValue={filters.q ?? filters.student} placeholder="Search borrower, student ID, or transaction" /></label><select name="status" defaultValue={filters.status ?? ""} aria-label="Filter by transaction status"><option value="">All statuses</option><option value="active">Any active</option>{["borrowed","partial","incomplete","returned"].map((status) => <option key={status}>{status}</option>)}</select><label className="date-filter"><span>From</span><input name="from" type="date" defaultValue={filters.from} /></label><label className="date-filter"><span>To</span><input name="to" type="date" defaultValue={filters.to} /></label><button className="button button-secondary" type="submit">Apply</button></form>
      {transactions.length === 0 ? <div className="empty-state"><History aria-hidden="true" /><h2>No matching transactions</h2><p>Completed and active borrowing records will appear here.</p></div> : <div className="transaction-list">{transactions.map((transaction) => { const txItems = itemsByTransaction.get(transaction.id) ?? []; return <details className="transaction-row" key={transaction.id}><summary><span><strong>{transaction.borrower_name_snapshot}</strong><small>{transaction.borrower_student_id_snapshot} · {formatLabDate(transaction.borrowed_at)}</small></span><span className="transaction-summary"><b>{txItems.length} {txItems.length === 1 ? "tool" : "tools"}</b><StatusBadge value={transaction.status} /></span></summary><div className="transaction-detail"><dl><div><dt>Transaction</dt><dd className="mono">{transaction.id}</dd></div><div><dt>Year / Section</dt><dd>{transaction.borrower_year_section_snapshot ?? "—"}</dd></div><div><dt>Group</dt><dd>{transaction.borrower_group_snapshot ?? "—"}</dd></div><div><dt>Completed</dt><dd>{transaction.completed_at ? formatLabDate(transaction.completed_at) : "Outstanding"}</dd></div></dl><div className="table-wrap"><table><thead><tr><th>Asset</th><th>Tool</th><th>Status</th><th>Returned condition</th><th>Note</th></tr></thead><tbody>{txItems.map((item) => <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td><StatusBadge value={item.item_status} /></td><td>{item.return_condition ? <StatusBadge value={item.return_condition} /> : "—"}</td><td>{item.return_note ?? item.missing_note ?? "—"}</td></tr>)}</tbody></table></div></div></details>; })}</div>}
      {!filterError && <Pagination path="/history" params={filters} page={page} count={count} />}
    </section>
  </div>;
}
