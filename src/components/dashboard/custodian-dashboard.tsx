import Link from "next/link";
import {
  BarChart3, Box, Boxes, BriefcaseBusiness, ChevronRight, CircleCheck, Gauge,
  History, PackageCheck, QrCode, ScanLine, TriangleAlert, Undo2,
  UserRound, Wrench,
} from "lucide-react";
import type { DashboardMetrics } from "@/types/app";

export interface DashboardCategory { label: string; total: number; available: number }
export interface ActiveBorrower { initials: string; name: string; studentId: string; tools: number }

export function CustodianDashboard({ name, role, metrics, categories, borrowers }: {
  name: string;
  role: "custodian" | "instructor";
  metrics: DashboardMetrics;
  categories: DashboardCategory[];
  borrowers: ActiveBorrower[];
}) {
  const readOnly = role === "instructor";
  return (
    <>
      <header className="workspace-header">
        <div><h1>{readOnly ? "LABORATORY STATUS" : "TOOL-CRIB CHECKOUT COUNTER"}</h1><p>Welcome back, {name}.</p></div>
        <Link className="scan-shortcut" href={readOnly ? "/history" : "/scan"}>
          {readOnly ? <BarChart3 aria-hidden="true" /> : <QrCode aria-hidden="true" />}
          <span><strong>{readOnly ? "Review borrowing records" : "Scan Student Mechanic Leader QR"}</strong><small>{readOnly ? "inventory and custody are read-only" : "to begin checkout or return"}</small></span>
        </Link>
      </header>
      <section className="metric-ribbon" aria-label="Inventory overview">
        <Metric icon={Box} label="TOTAL TOOLS" value={metrics.total} />
        <Metric icon={CircleCheck} label="AVAILABLE" value={metrics.available} tone="success" />
        <Metric icon={UserRound} label="BORROWED" value={metrics.borrowed} />
        <Metric icon={TriangleAlert} label="MISSING" value={metrics.missing} tone="warning" />
        <Metric icon={History} label="ACTIVE TRANSACTIONS" value={metrics.activeTransactions} tone="violet" />
        <Link className="metric-view" href="/history">View all <ChevronRight aria-hidden="true" /></Link>
      </section>
      <section className="counter-grid">
        <section className="counter-panel inventory-panel">
          <header><h2>READY FOR ISSUE</h2><p>Tools available by category</p></header>
          <div className="category-list">
            {categories.length === 0 ? <EmptyRows text="No tools have been added yet." /> : categories.slice(0, 6).map(({ label, total, available }) => (
              <Link className="category-row" href={`/tools?category=${encodeURIComponent(label)}`} key={label}>
                <span className="category-icon"><Gauge aria-hidden="true" /></span>
                <span className="category-data"><strong>{label} <em>{total}</em></strong><span className="availability-track"><i style={{ width: `${total ? Math.round((available / total) * 100) : 0}%` }} /></span></span>
                <span className="available-count">{available} available</span><ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link className="panel-footer" href="/tools">View all inventory <ChevronRight aria-hidden="true" /></Link>
        </section>
        <section className="counter-panel actions-panel">
          <header><h2>{readOnly ? "REVIEW AREAS" : "COUNTER ACTIONS"}</h2><p>{readOnly ? "Read-only laboratory monitoring" : "Scan QR or choose an action"}</p></header>
          <div className="action-stack">
            {readOnly ? <>
              <Link className="action-control primary" href="/tools"><span className="action-icon"><Wrench aria-hidden="true" /></span><span><strong>VIEW INVENTORY</strong><small>Monitor tool condition and availability</small></span><ChevronRight aria-hidden="true" /></Link>
              <Link className="action-control secondary" href="/history"><span className="action-icon"><History aria-hidden="true" /></span><span><strong>VIEW HISTORY</strong><small>Review borrowers and tool usage</small></span><ChevronRight aria-hidden="true" /></Link>
            </> : <>
              <Link className="action-control primary" href="/borrow"><span className="action-icon"><BriefcaseBusiness aria-hidden="true" /></span><span><strong>BORROW TOOLS</strong><small>Issue tools to a student mechanic leader</small></span><ChevronRight aria-hidden="true" /></Link>
              <Link className="action-control secondary" href="/return"><span className="action-icon"><Undo2 aria-hidden="true" /></span><span><strong>PROCESS RETURN</strong><small>Accept returned tools and update inventory</small></span><ChevronRight aria-hidden="true" /></Link>
            </>}
            <Link className="mobile-helper" href={readOnly ? "/users" : "/scan"}><ScanLine aria-hidden="true" /><span><strong>{readOnly ? "Borrower directory" : "Camera and USB scanning"}</strong><small>{readOnly ? "View approved student mechanic leaders." : "Use this device camera, scanner, or typed code."}</small></span></Link>
          </div>
        </section>
        <section className="counter-panel custody-panel">
          <header><h2>CUSTODY NOW</h2><p>Current borrowers with active tool sets</p></header>
          <div className="borrower-list">
            {borrowers.length === 0 ? <EmptyRows text="No active tool custody." /> : borrowers.slice(0, 6).map((borrower) => (
              <Link className="borrower-row" href={`/history?student=${encodeURIComponent(borrower.studentId)}`} key={borrower.studentId}>
                <span className="avatar">{borrower.initials}</span><span className="borrower-data"><strong>{borrower.name}</strong><small>{borrower.studentId}</small><small>{borrower.tools} {borrower.tools === 1 ? "tool" : "tools"}</small></span><span className="status-chip"><History aria-hidden="true" />CHECKED OUT</span><ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link className="panel-footer" href="/history?status=active">View all active transactions <ChevronRight aria-hidden="true" /></Link>
        </section>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, tone = "default" }: { icon: typeof Boxes; label: string; value: number; tone?: string }) {
  return <div className={`metric ${tone}`}><Icon aria-hidden="true" /><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function EmptyRows({ text }: { text: string }) { return <div className="empty-state compact"><PackageCheck aria-hidden="true" /><p>{text}</p></div>; }
