import Link from "next/link";
import {
  BarChart3, Box, Boxes, BriefcaseBusiness, ChevronRight, CircleCheck, Download, Gauge,
  History, PackageCheck, Printer, QrCode, ScanLine, TriangleAlert, Undo2,
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
    <div className="dashboard-home">
      <header className="workspace-header">
        <div><p className="dashboard-eyebrow">{readOnly ? "Instructor overview" : "Custodian workspace"}</p><h1>{readOnly ? "Laboratory overview" : "What would you like to do?"}</h1><p>Welcome, {name}. {readOnly ? "Review tool availability and borrowing records." : "Choose a task below to get started."}</p></div>
        <Link className="scan-shortcut" href={readOnly ? "/history" : "/scan"}>
          {readOnly ? <BarChart3 aria-hidden="true" /> : <QrCode aria-hidden="true" />}
          <span><strong>{readOnly ? "Review borrowing records" : "Open QR scanner"}</strong><small>{readOnly ? "View laboratory records" : "Camera, USB scanner, or typed code"}</small></span>
        </Link>
      </header>
      <section className="task-grid" aria-label="Main tasks">
        <Task href={readOnly ? "/tools" : "/borrow"} icon={readOnly ? Wrench : BriefcaseBusiness} title={readOnly ? "Check inventory" : "Borrow tools"} description={readOnly ? "See each tool and its current status." : "Select a student, scan tools, and confirm."} primary />
        <Task href={readOnly ? "/history" : "/return"} icon={readOnly ? History : Undo2} title={readOnly ? "Review history" : "Return tools"} description={readOnly ? "Review who borrowed and returned each tool." : "Identify the student and record returned tools."} />
        <Task href={readOnly ? "/users" : "/tools"} icon={readOnly ? UserRound : Wrench} title={readOnly ? "View students" : "Manage inventory"} description={readOnly ? "Look up student records and approval status." : "Add tools, check availability, and print QR labels."} />
      </section>
      <section className="metric-ribbon" aria-label="Inventory overview">
        <Metric icon={Box} label="Total tools" value={metrics.total} />
        <Metric icon={CircleCheck} label="Available" value={metrics.available} tone="success" />
        <Metric icon={UserRound} label="Borrowed" value={metrics.borrowed} />
        <Metric icon={TriangleAlert} label="Missing" value={metrics.missing} tone="warning" />
        <Metric icon={History} label="Active transactions" value={metrics.activeTransactions} tone="violet" />
        <Link className="metric-view" href="/history">View all <ChevronRight aria-hidden="true" /></Link>
      </section>
      <section className="counter-grid">
        <section className="counter-panel inventory-panel">
          <header><h2>Ready for issue</h2><p>Tools available by category</p></header>
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
        <section className="counter-panel custody-panel">
          <header><h2>Currently in custody</h2><p>Borrowers with active tool sets</p></header>
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
      <section className="workspace-tools" aria-labelledby="workspace-tools-title">
        <header><h2 id="workspace-tools-title">Useful tools</h2><p>Shortcuts for everyday laboratory work.</p></header>
        <div className="utility-grid">
          <a href="/api/reports/inventory.csv"><Download aria-hidden="true" /><span><strong>Export inventory</strong><small>Download the current inventory as CSV.</small></span></a>
          <Link href="/tools/labels"><Printer aria-hidden="true" /><span><strong>Print QR labels</strong><small>Open the printable tool label sheet.</small></span></Link>
          <Link href="/tools?status=missing"><TriangleAlert aria-hidden="true" /><span><strong>Find missing tools</strong><small>Review tools recorded as missing.</small></span></Link>
          <Link href="/history?status=active"><ScanLine aria-hidden="true" /><span><strong>Outstanding loans</strong><small>Find tools that still need to come back.</small></span></Link>
          <Link href="/history"><BarChart3 aria-hidden="true" /><span><strong>Print or export history</strong><small>Filter borrowing records and save a report.</small></span></Link>
        </div>
      </section>
    </div>
  );
}

function Task({ href, icon: Icon, title, description, primary = false }: { href: string; icon: typeof Wrench; title: string; description: string; primary?: boolean }) {
  return <Link className={`task-card${primary ? " task-primary" : ""}`} href={href}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight aria-hidden="true" /></Link>;
}

function Metric({ icon: Icon, label, value, tone = "default" }: { icon: typeof Boxes; label: string; value: number; tone?: string }) {
  return <div className={`metric ${tone}`}><Icon aria-hidden="true" /><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function EmptyRows({ text }: { text: string }) { return <div className="empty-state compact"><PackageCheck aria-hidden="true" /><p>{text}</p></div>; }
