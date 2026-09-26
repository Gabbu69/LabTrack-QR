import Link from "next/link";
import { History, PackageCheck, QrCode, UserCheck } from "lucide-react";
import { CustodianDashboard, type ActiveBorrower, type DashboardCategory } from "@/components/dashboard/custodian-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMetrics, TransactionItem } from "@/types/app";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: summary, error: summaryError } = await supabase.rpc("dashboard_summary");
  if (summaryError || !summary) throw new Error("Dashboard totals could not be loaded. Please try again.");
  const snapshot = summary as unknown as { metrics: DashboardMetrics; categories: DashboardCategory[]; borrowers: (ActiveBorrower & { id: string })[]; student: { transactions: number; borrowed: number; missing: number; items: TransactionItem[] } };
  if (profile.role === "student") {
    const outstanding = snapshot.student.items;
    return (
      <div className="page-wrap">
        <PageHeader eyebrow="STUDENT MECHANIC LEADER" title={`WELCOME, ${profile.full_name.toUpperCase()}`} description="Show your personal QR to the custodian when borrowing or returning laboratory tools." actions={<Link className="button button-primary" href="/my-qr"><QrCode aria-hidden="true" />Show my QR</Link>} />
        {profile.status === "pending" && <div className="notice warning"><UserCheck aria-hidden="true" /><div><strong>Approval pending</strong><p>Your profile is ready, but a custodian must approve it before tools can be issued.</p></div></div>}
        <section className="summary-grid">
          <article className="summary-card"><PackageCheck aria-hidden="true" /><span><small>Currently borrowed</small><strong>{snapshot.student.borrowed}</strong></span></article>
          <article className="summary-card warning"><History aria-hidden="true" /><span><small>Marked missing</small><strong>{snapshot.student.missing}</strong></span></article>
          <article className="summary-card"><QrCode aria-hidden="true" /><span><small>Total transactions</small><strong>{snapshot.student.transactions}</strong></span></article>
        </section>
        <section className="content-card"><div className="card-heading"><div><h2>TOOLS IN YOUR CUSTODY</h2><p>These items still need to be returned to the custodian.</p></div><Link className="text-link" href="/borrowed">View details</Link></div>
          {outstanding.length === 0 ? <div className="empty-state"><PackageCheck aria-hidden="true" /><h3>No tools in your custody</h3><p>Your currently borrowed tools will appear here.</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Status</th></tr></thead><tbody>{outstanding.slice(0, 8).map((item) => <tr key={item.id}><td className="mono">{item.asset_code_snapshot}</td><td>{item.tool_name_snapshot}</td><td><StatusBadge value={item.item_status} /></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    );
  }
  return <CustodianDashboard name={profile.full_name} role={profile.role} metrics={snapshot.metrics} categories={snapshot.categories} borrowers={snapshot.borrowers.map((borrower) => ({ ...borrower, initials: initials(borrower.name) }))} />;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST"; }
