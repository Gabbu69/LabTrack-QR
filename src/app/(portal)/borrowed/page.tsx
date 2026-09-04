import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionItem } from "@/types/app";

export const metadata = { title: "Borrowed Tools" };

export default async function BorrowedToolsPage() {
  const profile = await requireProfile(["student"]);
  const supabase = await createClient();
  const { data: transactions } = await supabase.from("transactions").select("*").eq("borrower_id", profile.id).neq("status", "returned").order("borrowed_at", { ascending: false });
  const typedTransactions = (transactions ?? []) as Transaction[];
  const ids = typedTransactions.map((transaction) => transaction.id);
  const { data: items } = ids.length ? await supabase.from("transaction_items").select("*").in("transaction_id", ids).in("item_status", ["borrowed", "missing"]).order("created_at", { ascending: false }) : { data: [] };
  const typedItems = (items ?? []) as TransactionItem[];
  return <div className="page-wrap"><PageHeader eyebrow="CURRENT CUSTODY" title="BORROWED TOOLS" description="All tools that are still assigned to you, including items marked missing." />
    <section className="content-card">{typedItems.length === 0 ? <div className="empty-state"><PackageCheck aria-hidden="true" /><h2>No outstanding tools</h2><p>You have returned all issued tools.</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Borrowed</th><th>Issue condition</th><th>Status</th></tr></thead><tbody>{typedItems.map((item) => { const tx = typedTransactions.find((transaction) => transaction.id === item.transaction_id); return <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td>{tx ? new Date(tx.borrowed_at).toLocaleString("en-PH") : "—"}</td><td><StatusBadge value={item.issue_condition} /></td><td><StatusBadge value={item.item_status} /></td></tr>; })}</tbody></table></div>}</section>
  </div>;
}
