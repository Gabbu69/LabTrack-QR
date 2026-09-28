"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function PortalNavLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: LucideIcon; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link className={active ? "portal-nav-link active" : "portal-nav-link"} href={href} aria-current={active ? "page" : undefined} onNavigate={onNavigate}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </Link>
  );
}
