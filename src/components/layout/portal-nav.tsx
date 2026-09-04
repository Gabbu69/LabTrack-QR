"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function PortalNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link className={active ? "rail-link active" : "rail-link"} href={href} aria-current={active ? "page" : undefined}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </Link>
  );
}
