import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { outstandingTransactions, transactionItems } from "@/lib/records";
import { formatLabDate } from "@/lib/query-filters";

export const metadata = { title: "Borrowed Tools" };

export default async function BorrowedToolsPage() {
  const profile = await requireProfile(["student"]);
  const supabase = await createClient();
  const typedTransactions = await outstandingTransactions(supabase, profile.id);
  const ids = typedTransactions.map((transaction) => transaction.id);
  const typedItems = (await transactionItems(supabase, ids)).filter((item) => ["borrowed", "missing"].includes(item.item_status));
  return <div className="page-wrap"><PageHeader eyebrow="CURRENT CUSTODY" title="BORROWED TOOLS" description="All tools that are still assigned to you, including items marked missing." />
    <section className="content-card">{typedItems.length === 0 ? <div className="empty-state"><PackageCheck aria-hidden="true" /><h2>No outstanding tools</h2><p>You have returned all issued tools.</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Borrowed</th><th>Issue condition</th><th>Status</th></tr></thead><tbody>{typedItems.map((item) => { const tx = typedTransactions.find((transaction) => transaction.id === item.transaction_id); return <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td>{tx ? formatLabDate(tx.borrowed_at) : "—"}</td><td><StatusBadge value={item.issue_condition} /></td><td><StatusBadge value={item.item_status} /></td></tr>; })}</tbody></table></div>}</section>
  </div>;
}
