"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3, ClipboardList, House, LogOut, Menu, PackageCheck, QrCode,
  RotateCcw, ScanLine, UserRound, Users, Wrench, X,
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
  const drawer = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const currentPage = navigation[profile.role].find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "LabTrack QR";

  useEffect(() => { drawer.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <main className="station-shell portal-shell">
      <a className="portal-skip" href="#portal-content">Skip to content</a>
      <aside className="portal-sidebar" aria-label="Primary navigation">
        <SidebarContent profile={profile} roleLabel={roleLabel} />
      </aside>
      <header className="portal-mobile-bar">
        <button type="button" className="portal-menu-button" aria-label="Open menu" aria-haspopup="dialog" aria-controls="portal-menu" onClick={() => drawer.current?.showModal()}><Menu aria-hidden="true" /></button>
        <div><small>LABTRACK QR</small><strong>{currentPage}</strong></div>
        <LabTrackMark />
      </header>
      <dialog ref={drawer} id="portal-menu" className="portal-drawer" aria-label="Navigation menu" onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
        <SidebarContent profile={profile} roleLabel={roleLabel} onClose={() => drawer.current?.close()} />
      </dialog>
      <section className="station-workspace" id="portal-content" tabIndex={-1}>
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

function SidebarContent({ profile, roleLabel, onClose }: { profile: Profile; roleLabel: string; onClose?: () => void }) {
  return (
    <div className="portal-sidebar-content">
      <div className="portal-brand">
        <LabTrackMark />
        <span><small>AISAT DAVAO</small><strong>LabTrack <b>QR</b></strong></span>
        {onClose && <button type="button" className="portal-close-button" aria-label="Close menu" onClick={onClose}><X aria-hidden="true" /></button>}
      </div>
      <p className="portal-nav-caption">Workspace</p>
      <nav className="portal-links" aria-label={onClose ? "Mobile navigation" : "Main navigation"}>
        {navigation[profile.role].map((item) => <PortalNavLink key={item.href} {...item} onNavigate={onClose} />)}
      </nav>
      <div className="portal-account">
        <div className="portal-account-info"><span className="portal-account-icon"><UserRound aria-hidden="true" /></span><span><strong>{profile.full_name}</strong><small>{roleLabel}</small></span></div>
        <form action={signOutAction}>
          <button className="portal-nav-link portal-logout" type="submit"><LogOut aria-hidden="true" /><span>Log Out</span></button>
        </form>
      </div>
    </div>
  );
}
