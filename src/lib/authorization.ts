import type { AppRole } from "@/types/app";

const custodianOnly = ["/borrow", "/return", "/scan"];
const staffOnly = ["/tools", "/users"];

export function canAccessRoute(role: AppRole, pathname: string) {
  if (custodianOnly.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return role === "custodian";
  if (staffOnly.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return role === "custodian" || role === "instructor";
  if (pathname === "/my-qr" || pathname.startsWith("/borrowed")) return role === "student";
  return ["/dashboard", "/history", "/profile"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
