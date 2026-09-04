import Link from "next/link";
import { History, PackageCheck, QrCode, UserCheck } from "lucide-react";
import { CustodianDashboard, type ActiveBorrower, type DashboardCategory } from "@/components/dashboard/custodian-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMetrics, Tool, Transaction, TransactionItem } from "@/types/app";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  if (profile.role === "student") {
    const { data: transactions } = await supabase.from("transactions").select("*").eq("borrower_id", profile.id).order("borrowed_at", { ascending: false });
    const typedTransactions = (transactions ?? []) as Transaction[];
    const txIds = typedTransactions.map((transaction) => transaction.id);
    const { data: items } = txIds.length ? await supabase.from("transaction_items").select("*").in("transaction_id", txIds).order("created_at", { ascending: false }) : { data: [] };
    const typedItems = (items ?? []) as TransactionItem[];
    const outstanding = typedItems.filter((item) => item.item_status !== "returned");
    return (
      <div className="page-wrap">
        <PageHeader eyebrow="STUDENT MECHANIC LEADER" title={`WELCOME, ${profile.full_name.toUpperCase()}`} description="Show your personal QR to the custodian when borrowing or returning laboratory tools." actions={<Link className="button button-primary" href="/my-qr"><QrCode aria-hidden="true" />Show my QR</Link>} />
        {profile.status === "pending" && <div className="notice warning"><UserCheck aria-hidden="true" /><div><strong>Approval pending</strong><p>Your profile is ready, but a custodian must approve it before tools can be issued.</p></div></div>}
        <section className="summary-grid">
          <article className="summary-card"><PackageCheck aria-hidden="true" /><span><small>Currently borrowed</small><strong>{outstanding.filter((item) => item.item_status === "borrowed").length}</strong></span></article>
          <article className="summary-card warning"><History aria-hidden="true" /><span><small>Marked missing</small><strong>{outstanding.filter((item) => item.item_status === "missing").length}</strong></span></article>
          <article className="summary-card"><QrCode aria-hidden="true" /><span><small>Total transactions</small><strong>{typedTransactions.length}</strong></span></article>
        </section>
        <section className="content-card"><div className="card-heading"><div><h2>TOOLS IN YOUR CUSTODY</h2><p>These items still need to be returned to the custodian.</p></div><Link className="text-link" href="/borrowed">View details</Link></div>
          {outstanding.length === 0 ? <div className="empty-state"><PackageCheck aria-hidden="true" /><h3>No tools in your custody</h3><p>Your currently borrowed tools will appear here.</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Status</th></tr></thead><tbody>{outstanding.slice(0, 8).map((item) => <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td><StatusBadge value={item.item_status} /></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    );
  }
  const [{ data: tools }, { data: transactions }, { data: items }] = await Promise.all([
    supabase.from("tools").select("*").is("archived_at", null),
    supabase.from("transactions").select("*").neq("status", "returned").order("borrowed_at", { ascending: false }),
    supabase.from("transaction_items").select("*").in("item_status", ["borrowed", "missing"]),
  ]);
  const typedTools = (tools ?? []) as Tool[];
  const typedTransactions = (transactions ?? []) as Transaction[];
  const typedItems = (items ?? []) as TransactionItem[];
  const metrics: DashboardMetrics = { total: typedTools.length, available: typedTools.filter((tool) => tool.status === "available").length, borrowed: typedTools.filter((tool) => tool.status === "borrowed").length, missing: typedTools.filter((tool) => tool.status === "missing").length, activeTransactions: typedTransactions.length };
  const categoryMap = new Map<string, DashboardCategory>();
  typedTools.forEach((tool) => { const current = categoryMap.get(tool.category) ?? { label: tool.category, total: 0, available: 0 }; current.total += 1; if (tool.status === "available") current.available += 1; categoryMap.set(tool.category, current); });
  const borrowerMap = new Map<string, ActiveBorrower>();
  typedTransactions.forEach((transaction) => { const count = typedItems.filter((item) => item.transaction_id === transaction.id).length; const existing = borrowerMap.get(transaction.borrower_id); if (existing) existing.tools += count; else borrowerMap.set(transaction.borrower_id, { initials: initials(transaction.borrower_name_snapshot), name: transaction.borrower_name_snapshot, studentId: transaction.borrower_student_id_snapshot, tools: count }); });
  return <CustodianDashboard name={profile.full_name} role={profile.role} metrics={metrics} categories={[...categoryMap.values()].sort((a, b) => b.total - a.total)} borrowers={[...borrowerMap.values()]} />;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST"; }
