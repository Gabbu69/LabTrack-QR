import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  Box,
  Boxes,
  BriefcaseBusiness,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  History,
  Drill,
  Gauge,
  House,
  LogOut,
  PackageCheck,
  Plug,
  QrCode,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldAlert,
  TriangleAlert,
  Undo2,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: House, active: true },
  { label: "Borrow Tools", icon: PackageCheck },
  { label: "Process Return", icon: RotateCcw },
  { label: "Tool Inventory", icon: Wrench },
  { label: "Transactions", icon: ClipboardList },
  { label: "Reports", icon: BarChart3 },
  { label: "Users", icon: Users },
  { label: "Settings", icon: Settings },
];

const categories = [
  { label: "Hand Tools", total: 68, available: 52, icon: Wrench },
  { label: "Fastening Tools", total: 42, available: 31, icon: Settings },
  { label: "Power Tools", total: 24, available: 16, icon: Drill },
  { label: "Measuring & Inspection", total: 28, available: 22, icon: Gauge },
  { label: "Electrical Tools", total: 18, available: 12, icon: Plug },
  { label: "Kits & Sets", total: 34, available: 15, icon: Boxes },
];

const borrowers = [
  ["JM", "Jordan Mitchell", "AAMT231-04", "8 tools"],
  ["RP", "Riley Patel", "AAMT231-07", "7 tools"],
  ["TC", "Taylor Chen", "AAMT231-11", "5 tools"],
  ["BW", "Blake Williams", "AAMT231-02", "6 tools"],
  ["MC", "Morgan Casey", "AAMT231-09", "4 tools"],
];

export default function DashboardComp() {
  return (
    <main className="station-shell">
      <aside className="station-rail" aria-label="Primary navigation">
        <div className="rail-brand"><ScanLine aria-hidden="true" /><span>LABTRACK <b>QR</b></span></div>
        <nav className="rail-nav">
          {navigation.map(({ label, icon: Icon, active }) => (
            <Link className={active ? "rail-link active" : "rail-link"} href="#" key={label} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className="rail-link rail-logout" type="button"><LogOut aria-hidden="true" /><span>Log Out</span></button>
      </aside>

      <section className="station-workspace">
        <div className="demo-ribbon"><strong>DEMO MODE</strong><span>Data is simulated and will reset periodically.</span><div className="ribbon-user">10:24 AM <i /> May 22, 2025 <i /> Tool Custodian&nbsp;&nbsp; Alex Morgan</div></div>

        <header className="workspace-header">
          <div><h1>TOOL-CRIB CHECKOUT COUNTER</h1><p>Welcome back, Alex.</p></div>
          <button className="scan-shortcut" type="button"><QrCode aria-hidden="true" /><span><strong>Scan Student Mechanic Leader QR</strong><small>to begin checkout or return</small></span></button>
        </header>

        <section className="metric-ribbon" aria-label="Inventory overview">
          <Metric icon={Box} label="TOTAL TOOLS" value="214" />
          <Metric icon={CircleCheck} label="AVAILABLE" value="148" tone="success" />
          <Metric icon={UserRound} label="BORROWED" value="58" />
          <Metric icon={TriangleAlert} label="MISSING" value="8" tone="warning" />
          <Metric icon={History} label="ACTIVE TRANSACTIONS" value="12" tone="violet" />
          <Link className="metric-view" href="#">View all <ChevronRight aria-hidden="true" /></Link>
        </section>

        <section className="counter-grid">
          <section className="counter-panel inventory-panel">
            <header><h2>READY FOR ISSUE</h2><p>Tools available by category</p></header>
            <div className="category-list">
              {categories.map(({ label, total, available, icon: Icon }) => (
                <button className="category-row" type="button" key={label}>
                  <span className="category-icon"><Icon aria-hidden="true" /></span>
                  <span className="category-data"><strong>{label} <em>{total}</em></strong><span className="availability-track"><i style={{ width: `${Math.round((available / total) * 100)}%` }} /></span></span>
                  <span className="available-count">{available} available</span><ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
            <Link className="panel-footer" href="#">View all inventory <ChevronRight aria-hidden="true" /></Link>
          </section>

          <section className="counter-panel actions-panel">
            <header><h2>COUNTER ACTIONS</h2><p>Scan QR or choose an action</p></header>
            <div className="action-stack">
              <Link className="action-control primary" href="#"><span className="action-icon"><BriefcaseBusiness aria-hidden="true" /></span><span><strong>BORROW TOOLS</strong><small>Issue tools to a student mechanic leader</small></span><ChevronRight aria-hidden="true" /></Link>
              <Link className="action-control secondary" href="#"><span className="action-icon"><Undo2 aria-hidden="true" /></span><span><strong>PROCESS RETURN</strong><small>Accept returned tools and update inventory</small></span><ChevronRight aria-hidden="true" /></Link>
              <button className="mobile-helper" type="button"><QrCode aria-hidden="true" /><span><strong>Prefer handheld scanning?</strong><small>Use a mobile device to scan the QR code and continue here.</small></span></button>
            </div>
          </section>

          <section className="counter-panel custody-panel">
            <header><h2>CUSTODY NOW</h2><p>Current borrowers with active tool sets</p></header>
            <div className="borrower-list">
              {borrowers.map(([initials, name, id, tools]) => (
                <button className="borrower-row" type="button" key={id}>
                  <span className="avatar">{initials}</span><span className="borrower-data"><strong>{name}</strong><small>{id}</small><small>{tools}</small></span><span className="status-chip"><History aria-hidden="true" />CHECKED OUT</span><ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
            <Link className="panel-footer" href="#">View all active transactions <ChevronRight aria-hidden="true" /></Link>
          </section>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone = "default" }: { icon: typeof Boxes; label: string; value: string; tone?: string }) {
  return <div className={`metric ${tone}`}><Icon aria-hidden="true" /><span><small>{label}</small><strong>{value}</strong></span></div>;
}
