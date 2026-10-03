import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHistoryReport } from "@/lib/history-report";
import { formatLabDate, parseHistoryFilters, type SearchParams } from "@/lib/query-filters";
import { Notice } from "@/components/feedback/notice";
import { PrintButton } from "@/components/ui/print-button";

export const metadata = { title: "Printable borrowing report", robots: { index: false, follow: false } };

export default async function HistoryPrintPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireActiveProfile();
  const filters = await searchParams;
  const backParams = new URLSearchParams();
  for (const key of ["q", "student", "status", "from", "to"]) if (filters[key]) backParams.set(key, filters[key]!);
  let filterError = "";
  try { parseHistoryFilters(filters); } catch (error) { filterError = error instanceof Error ? error.message : "Invalid report filters."; }
  const back = `/history${backParams.size ? `?${backParams}` : ""}`;
  if (filterError) return <div className="page-wrap"><Link className="back-link" href={back}><ArrowLeft aria-hidden="true" />Back to history</Link><Notice error={filterError} /></div>;
  const report = await loadHistoryReport(await createClient(), filters);
  const period = filters.from || filters.to ? `${filters.from || "Beginning"} to ${filters.to || "Present"}` : "All dates";
  const search = (filters.q ?? filters.student ?? "").trim();
  return <div className="page-wrap report-page">
    <div className="report-actions"><Link className="back-link" href={back}><ArrowLeft aria-hidden="true" />Back to history</Link><PrintButton label="Print A4 report" /></div>
    <section className="lab-history-report" aria-label="Borrowing and return report">
      <header className="report-heading"><ClipboardList aria-hidden="true" /><div><p>LABTRACK QR</p><h1>{profile.role === "student" ? "My borrowing and return report" : "Borrowing and return report"}</h1><p>{profile.data_scope === "demo" ? "DEMO RECORDS — fictional laboratory data" : "Laboratory custody records"}</p></div></header>
      <dl className="report-details"><div><dt>Period</dt><dd>{period} · Philippine time</dd></div><div><dt>Status</dt><dd>{filters.status === "active" ? "Any active" : filters.status || "All statuses"}</dd></div>{search && <div><dt>Search</dt><dd>{search}</dd></div>}<div><dt>Generated</dt><dd>{formatLabDate(report.generatedAt)}</dd></div><div><dt>Prepared by</dt><dd>{profile.full_name} · {profile.role}</dd></div></dl>
      <dl className="report-totals"><div><dt>Transactions</dt><dd>{report.totals.transactions}</dd></div><div><dt>Tool entries</dt><dd>{report.totals.items}</dd></div><div><dt>Returned</dt><dd>{report.totals.returned}</dd></div><div><dt>Outstanding</dt><dd>{report.totals.outstanding}</dd></div><div><dt>Missing</dt><dd>{report.totals.missing}</dd></div></dl>
      <p className="report-explanation">Outstanding includes tools marked missing. Tool entries count each recorded handoff; the same asset can appear in more than one transaction.</p>
      {report.transactions.length === 0 ? <p className="report-empty">No transactions match these filters.</p> : report.transactions.map(transaction => <article className="report-transaction" key={transaction.id}>
        <div className="report-transaction-heading"><h2>{transaction.borrower_name_snapshot}</h2><span>{transaction.status}</span></div>
        <p>{transaction.borrower_student_id_snapshot} · {transaction.borrower_year_section_snapshot || "Section not recorded"} · {transaction.borrower_group_snapshot || "Group not recorded"}</p>
        <p>Borrowed: {formatLabDate(transaction.borrowed_at)} · Completed: {transaction.completed_at ? formatLabDate(transaction.completed_at) : "Outstanding"}</p>
        <p className="report-reference">Reference: {transaction.id}</p>
        <div className="table-wrap"><table><thead><tr><th>Asset / tool</th><th>Item status</th><th>Returned / condition</th><th>Notes</th></tr></thead><tbody>{(report.byTransaction.get(transaction.id) ?? []).map(item => <tr key={item.id}>
          <td><strong>{item.asset_code_snapshot}</strong><span>{item.tool_name_snapshot}</span></td><td>{item.item_status}</td><td>{item.returned_at ? formatLabDate(item.returned_at) : "—"}<span>{item.return_condition || "—"}</span></td><td>{item.return_note && <span>Return: {item.return_note}</span>}{item.missing_note && <span>Missing: {item.missing_note}</span>}{item.missing_at && <span>Marked missing: {formatLabDate(item.missing_at)}</span>}{!item.return_note && !item.missing_note && !item.missing_at && "—"}</td>
        </tr>)}</tbody></table></div>
      </article>)}
      <footer className="report-footer"><p>All matching records available to your account are included. Records may change after this report is generated.</p><div><span>Prepared by: ____________________</span><span>Reviewed by: ____________________</span></div></footer>
    </section>
  </div>;
}
