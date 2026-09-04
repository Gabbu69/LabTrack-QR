"use client";

import {
  BarChart3, ClipboardList, House, LogOut, Menu, PackageCheck, QrCode,
  RotateCcw, ScanLine, UserRound, Users, Wrench,
} from "lucide-react";
import type { AppRole, Profile } from "@/types/app";
import { signOutAction } from "@/app/actions/auth";
import { LabTrackMark } from "@/components/branding/labtrack-mark";
import { DemoResetButton } from "@/components/demo/demo-reset-button";
import { PortalNavLink } from "@/components/layout/portal-nav";

const navigation: Record<AppRole, { href: string; label: string; icon: typeof House }[]> = {
  student: [
    { href: "/dashboard", label: "Dashboard", icon: House },
    { href: "/my-qr", label: "My QR", icon: QrCode },
    { href: "/borrowed", label: "Borrowed Tools", icon: PackageCheck },
    { href: "/history", label: "My History", icon: ClipboardList },
    { href: "/profile", label: "Profile", icon: UserRound },
  ],
  custodian: [
    { href: "/dashboard", label: "Dashboard", icon: House },
    { href: "/borrow", label: "Borrow Tools", icon: PackageCheck },
    { href: "/return", label: "Process Return", icon: RotateCcw },
    { href: "/tools", label: "Tool Inventory", icon: Wrench },
    { href: "/scan", label: "QR Scanner", icon: ScanLine },
    { href: "/history", label: "History & Reports", icon: BarChart3 },
    { href: "/users", label: "User Management", icon: Users },
    { href: "/profile", label: "Profile", icon: UserRound },
  ],
  instructor: [
    { href: "/dashboard", label: "Dashboard", icon: House },
    { href: "/tools", label: "Inventory", icon: Wrench },
    { href: "/history", label: "Transactions", icon: ClipboardList },
    { href: "/users", label: "Students", icon: Users },
    { href: "/profile", label: "Profile", icon: UserRound },
  ],
};

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const roleLabel = profile.role === "custodian" ? "Tool Custodian" : profile.role === "instructor" ? "Laboratory Instructor" : "Student Mechanic Leader";
  return (
    <main className="station-shell">
      <aside className="station-rail" aria-label="Primary navigation">
        <div className="rail-brand">
          <LabTrackMark />
          <span className="rail-brand-copy"><small>AISAT DAVAO</small><strong>LABTRACK <b>QR</b></strong></span>
        </div>
        <nav className="rail-nav">
          {navigation[profile.role].map((item) => <PortalNavLink key={item.href} {...item} />)}
        </nav>
        <details className="mobile-nav-menu">
          <summary><Menu aria-hidden="true" /><span>Menu</span></summary>
          <nav aria-label="Mobile navigation">
            {navigation[profile.role].map((item) => <PortalNavLink key={item.href} {...item} />)}
          </nav>
        </details>
        <form action={signOutAction} className="rail-logout-form">
          <button className="rail-link rail-logout" type="submit"><LogOut aria-hidden="true" /><span>Log Out</span></button>
        </form>
      </aside>
      <section className="station-workspace">
        {profile.data_scope === "demo" && (
          <div className="demo-ribbon" role="status">
            <strong>DEMO MODE</strong><span>Fictional records are isolated from operational data.</span>
            <div className="ribbon-user"><span>{roleLabel}</span><i /><span>{profile.full_name}</span>{profile.role === "custodian" && <DemoResetButton />}</div>
          </div>
        )}
        {children}
      </section>
    </main>
  );
}
