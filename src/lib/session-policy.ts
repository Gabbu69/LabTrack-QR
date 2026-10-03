import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSupabaseSecret } from "@/lib/server-env";

export const SESSION_COOKIE = "labtrack-session";
export const IDLE_SECONDS = 30 * 60;
export const MAX_SESSION_SECONDS = 8 * 60 * 60;
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
type Session = { user: string; session: string; started: number; seen: number };
function signature(value: string) {
  return createHmac("sha256", requireSupabaseSecret()).update(`labtrack-session-v1:${value}`).digest("base64url");
}
export function signSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readSession(value: string | undefined, user: string, session: string, now = Date.now() / 1000): Session | null {
  if (!value || value.length > 2048) return null;
  const [payload, mac, extra] = value.split(".");
  if (!payload || !mac || extra) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (parsed.user !== user || parsed.session !== session || !Number.isFinite(parsed.started) || !Number.isFinite(parsed.seen)
      || parsed.started > parsed.seen || parsed.seen > now
      || now - parsed.seen >= IDLE_SECONDS || now - parsed.started >= MAX_SESSION_SECONDS) return null;
    return parsed;
  } catch { return null; }
}
